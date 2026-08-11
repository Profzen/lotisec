import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../database';
import { AuthRequest, requireAuth, requirePermission } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { canTransition, INCIDENT_TRANSITIONS, INTERVENTION_TRANSITIONS } from '../security/workflows';
import { notifyUsers } from '../services/push';

const router = Router();

async function createNotification(input:{organizationId?:string|null;recipientUserId?:string|null;roles?:string[];type:string;title:string;message:string;entityType?:string;entityId?:string}) {
  await query(`INSERT INTO operational_notifications(organization_id,recipient_user_id,recipient_roles,type,title,message,entity_type,entity_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[input.organizationId||null,input.recipientUserId||null,input.roles||[],input.type,input.title,input.message,input.entityType||null,input.entityId||null]);
}
async function audit(actorId:string|null|undefined,organizationId:string|null|undefined,action:string,entityType:string,entityId:string,metadata:Record<string,unknown>={}) {
  await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)`,[actorId||null,organizationId||null,action,entityType,entityId,metadata]);
}

const incidentSchema = z.object({
  source: z.enum(['mobile','web','operator','ussd','partner']).default('mobile'),
  type: z.string().min(2), severity: z.enum(['critical','high','medium','low','unknown']).default('medium'),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000).default(0), address: z.string().optional(),
  victims: z.number().int().min(0).max(99).default(0), vehicles: z.number().int().min(0).max(30).default(0),
  vehicle_type: z.string().optional(), description: z.string().max(2000).optional(),
  requested_service:z.enum(['fire','ambulance','samu','police']).optional(),
  flags: z.array(z.string()).max(12).default([]), qr_token: z.string().optional(), client_event_id: z.string().max(120).optional()
});

function score(severity: string, victims: number, vehicles: number, flags: string[]) {
  const base: Record<string, number> = { critical: 78, high: 62, medium: 42, low: 24, unknown: 35 };
  return Math.min(99, base[severity] + Math.min(victims * 3, 12) + Math.min(vehicles * 2, 8) + Math.min(flags.length * 2, 6));
}

router.post('/incidents', requireAuth, async (req: AuthRequest, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  const d = parsed.data;
  const allowedSource = req.permissions?.some((p) => p === '*' || p === 'incidents:manage') ? d.source : (d.source === 'web' ? 'web' : 'mobile');
  const saved = await query<any>(
    `INSERT INTO incidents (reporter_id, organization_id, source, type, severity, latitude, longitude, accuracy, address,
      victims, vehicles, vehicle_type, description, flags, priority_score, qr_token, client_event_id,requested_service)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (client_event_id) DO UPDATE SET client_event_id=EXCLUDED.client_event_id RETURNING *`,
    [req.userId, req.organizationId, allowedSource, d.type, d.severity, d.latitude, d.longitude, d.accuracy,
     d.address || null, d.victims, d.vehicles, d.vehicle_type || null, d.description || null, d.flags,
     score(d.severity,d.victims,d.vehicles,d.flags), d.qr_token || null, d.client_event_id || null,d.requested_service||null]
  );
  await query(`INSERT INTO incident_events (incident_id, actor_id, type, to_status) VALUES ($1,$2,'created','new')`, [saved.rows[0].id, req.userId]);
  await audit(req.userId,req.organizationId,'incident.created','incident',saved.rows[0].id,{source:allowedSource,severity:d.severity});
  await createNotification({roles:['admin','supervisor','dispatcher'],type:'incident.created',title:'Nouvel incident',message:`${d.type} · priorité ${saved.rows[0].priority_score}`,entityType:'incident',entityId:saved.rows[0].id});
  if(d.requested_service){
    const organizationTypes:Record<string,string[]>={fire:['fire_station'],ambulance:['ambulance_service'],samu:['samu'],police:['police','gendarmerie']};
    const target=await query<any>(`SELECT id FROM organizations WHERE active=true AND type=ANY($1::text[]) ORDER BY created_at ASC LIMIT 1`,[organizationTypes[d.requested_service]]);
    const targetRoles:Record<string,string[]>={fire:['firefighter'],ambulance:['ambulance_driver'],samu:['ambulance_driver'],police:[]};
    if(target.rows[0])await createNotification({organizationId:target.rows[0].id,roles:targetRoles[d.requested_service],type:'service.requested',title:'Demande de service',message:`${d.type} · position GPS disponible`,entityType:'incident',entityId:saved.rows[0].id});
  }

  // Calcul du moyen de secours le plus proche (Sapeurs-Pompiers / Ambulance) et hôpital le plus proche
  let closestUnit: any = null;
  let intervention: any = null;

  try {
    const unitRow = await query<any>(
      `SELECT ru.id, ru.organization_id, ru.name, ru.call_sign, ru.registration, ru.type,
              ROUND((ST_Distance(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) as distance_km
       FROM response_units ru JOIN organizations o ON o.id=ru.organization_id
       WHERE ru.status = 'available' AND ru.latitude IS NOT NULL AND ru.longitude IS NOT NULL
         AND ($3::text[] IS NULL OR o.type=ANY($3::text[]))
       ORDER BY ST_Distance(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
       LIMIT 1`,
      [d.longitude, d.latitude,d.requested_service ? ({fire:['fire_station'],ambulance:['ambulance_service'],samu:['samu'],police:['police','gendarmerie']} as Record<string,string[]>)[d.requested_service] : null]
    );
    if (unitRow.rows[0]) {
      const u = unitRow.rows[0];
      const dist = Number(u.distance_km) || 2.1;
      closestUnit = {
        id: u.id,
        organization_id: u.organization_id,
        name: u.name || `Unité ${u.call_sign || u.registration}`,
        type: u.type || 'ambulance',
        phone: '118',
        distance_km: dist,
        eta_minutes: Math.max(2, Math.round(dist * 2.2)),
        status: d.requested_service ? 'assigned' : 'recommended'
      };

      if (d.requested_service && pool) {
        const client=await pool.connect();
        try {
          await client.query('BEGIN');
          const locked=await client.query(`SELECT status FROM response_units WHERE id=$1 FOR UPDATE`,[u.id]);
          if(locked.rows[0]?.status==='available') {
            const assigned=await client.query(`INSERT INTO interventions(incident_id,organization_id,response_unit_id,status) VALUES($1,$2,$3,'assigned') RETURNING *`,[saved.rows[0].id,u.organization_id,u.id]);
            intervention=assigned.rows[0];
            await client.query(`UPDATE response_units SET status='assigned',updated_at=NOW() WHERE id=$1`,[u.id]);
            await client.query(`UPDATE incidents SET status='assigned',updated_at=NOW() WHERE id=$1`,[saved.rows[0].id]);
            await client.query(`INSERT INTO incident_events(incident_id,actor_id,type,from_status,to_status,metadata) VALUES($1,$2,'auto_assigned','new','assigned',$3)`,[saved.rows[0].id,req.userId,{response_unit_id:u.id,organization_id:u.organization_id}]);
            await client.query(`INSERT INTO operational_notifications(organization_id,recipient_roles,type,title,message,entity_type,entity_id) VALUES($1,$2,'intervention.assigned','Nouvelle mission prioritaire',$3,'intervention',$4)`,[u.organization_id,d.requested_service==='fire'?['firefighter']:['ambulance_driver'],`${d.type} · position GPS disponible`,intervention.id]);
            saved.rows[0].status='assigned';
          }
          await client.query('COMMIT');
        } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
        if(intervention) {
          const recipients=await query<{user_id:string}>(`SELECT DISTINCT ur.user_id FROM user_roles ur JOIN organization_members om ON om.user_id=ur.user_id AND om.organization_id=ur.organization_id WHERE ur.organization_id=$1 AND ur.role_key=ANY($2::text[]) AND om.status='active'`,[u.organization_id,d.requested_service==='fire'?['firefighter']:['ambulance_driver']]);
          await notifyUsers(recipients.rows.map(row=>row.user_id),'Nouvelle mission prioritaire',`${d.type} · ouvrez LOTISEC pour accepter`,{type:'intervention.assigned',intervention_id:intervention.id});
        }
      }
    }
  } catch (e) {
    console.warn('Erreur recherche response_units:', e);
  }

  let closestHospital: any = {
    name: 'CHU Sylvanus Olympio',
    distance_km: 1.8,
    eta_minutes: 4,
    phone: '+228 22 21 25 01'
  };

  try {
    const hospRow = await query<any>(
      `SELECT id, name, phone, address,
              ROUND((ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 1) as distance_km
       FROM medical_facilities
       WHERE urgences = true AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
       LIMIT 1`,
      [d.longitude, d.latitude]
    );
    if (hospRow.rows[0]) {
      const h = hospRow.rows[0];
      const dist = Number(h.distance_km) || 1.8;
      closestHospital = {
        id: h.id,
        name: h.name,
        phone: h.phone,
        address: h.address,
        distance_km: dist,
        eta_minutes: Math.max(3, Math.round(dist * 2.0))
      };
    }
  } catch (e) {
    console.warn('Erreur recherche medical_facilities:', e);
  }

  return res.status(201).json({
    incident: saved.rows[0],
    closest_unit: closestUnit,
    closest_hospital: closestHospital,
    intervention,
    dispatch_status: intervention ? 'assigned' : closestUnit ? 'recommended' : 'awaiting_dispatch'
  });
});

router.get('/incidents', requireAuth, requirePermission('incidents:read'), async (req: AuthRequest, res) => {
  const since = typeof req.query.since === 'string' ? req.query.since : null;
  const result = await query<any>(
    `SELECT * FROM incidents WHERE ($1::timestamptz IS NULL OR updated_at > $1::timestamptz)
     ORDER BY created_at DESC LIMIT 200`, [since]
  );
  return res.json({ incidents: result.rows, server_time: new Date().toISOString() });
});

router.patch('/incidents/:id/status', requireAuth, requirePermission('incidents:manage'), async (req: AuthRequest, res) => {
  const parsed = z.object({ status: z.enum(['validated','rejected','assigned','en_route','on_scene','patient_loaded','to_hospital','arrived_hospital','completed','cancelled']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: 'Statut invalide' });
  const before = await query<any>('SELECT status FROM incidents WHERE id=$1', [req.params.id]);
  if (!before.rows[0]) return res.status(404).json({ detail: 'Incident introuvable' });
  if (!canTransition(INCIDENT_TRANSITIONS,before.rows[0].status,parsed.data.status)) {
    return res.status(409).json({ detail:`Transition ${before.rows[0].status} -> ${parsed.data.status} interdite` });
  }
  const updated = await query<any>('UPDATE incidents SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [parsed.data.status, req.params.id]);
  await query(`INSERT INTO incident_events (incident_id, actor_id, type, from_status, to_status) VALUES ($1,$2,'status_changed',$3,$4)`, [req.params.id, req.userId, before.rows[0].status, parsed.data.status]);
  await audit(req.userId,req.organizationId,'incident.status_changed','incident',req.params.id,{from:before.rows[0].status,to:parsed.data.status});
  return res.json({ incident: updated.rows[0] });
});

router.get('/incidents/:id/timeline', requireAuth, requirePermission('incidents:read'), async (req, res) => {
  const result = await query<any>('SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY created_at ASC', [req.params.id]);
  return res.json({ events: result.rows });
});

router.get('/organizations', requireAuth, async (req: AuthRequest, res) => {
  const global = req.permissions?.includes('*') || req.roles?.some((r) => ['supervisor','dispatcher'].includes(r));
  const result = global
    ? await query<any>('SELECT * FROM organizations WHERE active=true ORDER BY name')
    : await query<any>('SELECT * FROM organizations WHERE id=$1 AND active=true', [req.organizationId]);
  return res.json({ organizations: result.rows });
});

router.post('/organizations', requireAuth, requirePermission('admin:manage'), async (req,res)=>{
  const parsed=z.object({name:z.string().min(2),type:z.enum(['lotisec','hospital','clinic','fire_station','samu','ambulance_service','police','gendarmerie','partner']),code:z.string().min(2),phone:z.string().optional(),address:z.string().optional(),latitude:z.number().optional(),longitude:z.number().optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:parsed.error.issues[0]?.message||'Organisation invalide'});
  const d=parsed.data;
  const result=await query<any>(`INSERT INTO organizations(name,type,code,phone,address,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[d.name,d.type,d.code,d.phone||null,d.address||null,d.latitude||null,d.longitude||null]);
  return res.status(201).json({organization:result.rows[0]});
});

router.get('/admin/users',requireAuth,requirePermission('admin:manage'),async(_req,res)=>{
  const result=await query<any>(`SELECT u.id,u.phone,p.first_name,p.last_name,COALESCE(json_agg(json_build_object('role',ur.role_key,'organization_id',ur.organization_id)) FILTER(WHERE ur.role_key IS NOT NULL),'[]') roles
    FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id,p.first_name,p.last_name ORDER BY u.phone LIMIT 500`);
  return res.json({users:result.rows});
});

router.post('/admin/users',requireAuth,requirePermission('admin:manage'),async(req:AuthRequest,res)=>{
  const parsed=z.object({phone:z.string().min(6),password:z.string().min(12),first_name:z.string().min(1),last_name:z.string().min(1)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:parsed.error.issues[0]?.message||'Compte invalide'});
  const d=parsed.data;
  const exists=await query('SELECT 1 FROM users WHERE phone=$1',[d.phone]);
  if(exists.rows[0])return res.status(409).json({detail:'Téléphone déjà utilisé'});
  const userId=uuidv4(); const profileId=uuidv4();
  await query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)',[userId,d.phone,await bcrypt.hash(d.password,12)]);
  await query(`INSERT INTO profiles(id,user_id,qr_token,profile_type,first_name,last_name,birth_date,gender,nationality,blood_type,access_code,has_vehicle)
    VALUES($1,$2,$3,'PROFESSIONAL',$4,$5,'01/01/2000','NC','Togo','NC',$6,false)`,[profileId,userId,uuidv4().slice(0,8).toUpperCase(),d.first_name,d.last_name,uuidv4().slice(0,8)]);
  await query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) VALUES($1,'citizen',NULL,$2)`,[userId,req.userId]);
  await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id) VALUES($1,$2,'user.created','user',$3)`,[req.userId,req.organizationId,userId]);
  return res.status(201).json({user:{id:userId,phone:d.phone,first_name:d.first_name,last_name:d.last_name}});
});

router.post('/admin/users/:id/roles',requireAuth,requirePermission('admin:manage'),async(req:AuthRequest,res)=>{
  const parsed=z.object({role:z.enum(['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent','zem_driver','citizen']),organization_id:z.string().uuid().nullable().optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Rôle invalide'});
  await query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) SELECT $1,$2,$3,$4 WHERE NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role_key=$2 AND organization_id IS NOT DISTINCT FROM $3)`,[req.params.id,parsed.data.role,parsed.data.organization_id||null,req.userId]);
  if(parsed.data.organization_id) await query(`INSERT INTO organization_members(organization_id,user_id,status) VALUES($1,$2,'active') ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active'`,[parsed.data.organization_id,req.params.id]);
  await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'role.granted','user',$3,$4)`,[req.userId,req.organizationId,req.params.id,{role:parsed.data.role,organization_id:parsed.data.organization_id||null}]);
  return res.status(201).json({success:true});
});

router.delete('/admin/users/:id/roles/:role',requireAuth,requirePermission('admin:manage'),async(req:AuthRequest,res)=>{
  const organizationId=typeof req.query.organization_id==='string'?req.query.organization_id:null;
  await query(`DELETE FROM user_roles WHERE user_id=$1 AND role_key=$2 AND organization_id IS NOT DISTINCT FROM $3`,[req.params.id,req.params.role,organizationId]);
  await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'role.revoked','user',$3,$4)`,[req.userId,req.organizationId,req.params.id,{role:req.params.role,organization_id:organizationId}]);
  return res.json({success:true});
});

router.get('/organizations/:id/members',requireAuth,async(req:AuthRequest,res)=>{
  const allowed=req.permissions?.includes('*')||(req.permissions?.includes('organization:members')&&req.organizationId===req.params.id);
  if(!allowed)return res.status(403).json({detail:'Organisation interdite'});
  const result=await query<any>(`SELECT u.id,u.phone,p.first_name,p.last_name,om.status,
    COALESCE(json_agg(ur.role_key) FILTER(WHERE ur.role_key IS NOT NULL),'[]') roles
    FROM organization_members om JOIN users u ON u.id=om.user_id LEFT JOIN profiles p ON p.user_id=u.id
    LEFT JOIN user_roles ur ON ur.user_id=u.id AND ur.organization_id=om.organization_id
    WHERE om.organization_id=$1 GROUP BY u.id,p.first_name,p.last_name,om.status ORDER BY p.last_name,u.phone`,[req.params.id]);
  return res.json({members:result.rows});
});

router.post('/organizations/:id/agents',requireAuth,async(req:AuthRequest,res)=>{
  const allowed=req.permissions?.includes('*')||(req.permissions?.includes('organization:members')&&req.organizationId===req.params.id);
  if(!allowed)return res.status(403).json({detail:'Organisation interdite'});
  const parsed=z.object({phone:z.string().min(6),password:z.string().min(12),first_name:z.string().min(1),last_name:z.string().min(1),role:z.enum(['hospital_agent','hospital_manager']).default('hospital_agent')}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:parsed.error.issues[0]?.message||'Agent invalide'});
  if(parsed.data.role==='hospital_manager'&&!req.permissions?.includes('*'))return res.status(403).json({detail:'Seul un administrateur peut créer un gestionnaire'});
  const organization=await query<any>(`SELECT id FROM organizations WHERE id=$1 AND active=true AND type IN ('hospital','clinic')`,[req.params.id]);
  if(!organization.rows[0])return res.status(400).json({detail:'Établissement hospitalier invalide'});
  if((await query('SELECT 1 FROM users WHERE phone=$1',[parsed.data.phone])).rows[0])return res.status(409).json({detail:'Téléphone déjà utilisé'});
  const userId=uuidv4();
  await query('INSERT INTO users(id,phone,password) VALUES($1,$2,$3)',[userId,parsed.data.phone,await bcrypt.hash(parsed.data.password,12)]);
  await query(`INSERT INTO profiles(id,user_id,qr_token,profile_type,first_name,last_name,birth_date,gender,nationality,blood_type,access_code,has_vehicle)
    VALUES($1,$2,$3,'PROFESSIONAL',$4,$5,'01/01/2000','NC','Togo','NC',$6,false)`,[uuidv4(),userId,uuidv4().slice(0,8).toUpperCase(),parsed.data.first_name,parsed.data.last_name,uuidv4().slice(0,8)]);
  await query(`INSERT INTO organization_members(organization_id,user_id,status) VALUES($1,$2,'active')`,[req.params.id,userId]);
  await query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) VALUES($1,$2,$3,$4)`,[userId,parsed.data.role,req.params.id,req.userId]);
  await audit(req.userId,req.organizationId,'organization.agent_created','user',userId,{organization_id:req.params.id,role:parsed.data.role});
  return res.status(201).json({user:{id:userId,phone:parsed.data.phone,first_name:parsed.data.first_name,last_name:parsed.data.last_name,role:parsed.data.role}});
});

router.delete('/organizations/:id/members/:userId',requireAuth,async(req:AuthRequest,res)=>{
  const allowed=req.permissions?.includes('*')||(req.permissions?.includes('organization:members')&&req.organizationId===req.params.id);
  if(!allowed)return res.status(403).json({detail:'Organisation interdite'});
  if(req.params.userId===req.userId)return res.status(409).json({detail:'Vous ne pouvez pas désactiver votre propre appartenance'});
  await query(`UPDATE organization_members SET status='inactive' WHERE organization_id=$1 AND user_id=$2`,[req.params.id,req.params.userId]);
  await query(`DELETE FROM user_roles WHERE organization_id=$1 AND user_id=$2`,[req.params.id,req.params.userId]);
  await audit(req.userId,req.organizationId,'organization.member_deactivated','user',req.params.userId,{organization_id:req.params.id});
  return res.json({success:true});
});

router.get('/facilities', requireAuth, async (_req, res) => {
  const result = await query<any>(`SELECT o.*, COALESCE(json_agg(fc ORDER BY fc.service) FILTER (WHERE fc.id IS NOT NULL),'[]') capacities
    FROM organizations o LEFT JOIN facility_capacities fc ON fc.organization_id=o.id
    WHERE o.active=true AND o.type IN ('hospital','clinic') GROUP BY o.id ORDER BY o.name`);
  return res.json({ facilities: result.rows });
});

router.put('/facilities/:id/capacities', requireAuth, requirePermission('facilities:manage'), async (req: AuthRequest, res) => {
  if (!req.permissions?.includes('*') && req.organizationId !== req.params.id) return res.status(403).json({ detail: 'Organisation interdite' });
  const parsed = z.object({ service:z.string().min(2), available:z.number().int().min(0), total:z.number().int().min(0), operational:z.boolean().default(true) }).safeParse(req.body);
  if (!parsed.success || parsed.data.available > parsed.data.total) return res.status(400).json({ detail:'Capacité invalide' });
  const d=parsed.data;
  const result=await query<any>(`INSERT INTO facility_capacities (organization_id,service,available,total,operational,updated_by)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (organization_id,service) DO UPDATE SET available=$3,total=$4,operational=$5,updated_by=$6,updated_at=NOW() RETURNING *`,
    [req.params.id,d.service,d.available,d.total,d.operational,req.userId]);
  await audit(req.userId,req.organizationId,'facility.capacity_updated','organization',req.params.id,{service:d.service,available:d.available,total:d.total});
  return res.json({ capacity:result.rows[0] });
});

router.get('/interventions', requireAuth, async (req: AuthRequest, res) => {
  const global=req.permissions?.some((p)=>p==='*'||p==='interventions:read'||p==='interventions:manage');
  const assigned=req.permissions?.includes('interventions:assigned');
  if (!global && !assigned) return res.status(403).json({detail:'Permission insuffisante'});
  const result=global ? await query<any>(`SELECT i.*, row_to_json(inc) incident FROM interventions i JOIN incidents inc ON inc.id=i.incident_id ORDER BY i.updated_at DESC LIMIT 200`)
    : await query<any>(`SELECT i.*, row_to_json(inc) incident FROM interventions i JOIN incidents inc ON inc.id=i.incident_id WHERE i.assigned_to=$1 OR i.organization_id=$2 ORDER BY i.updated_at DESC LIMIT 100`,[req.userId,req.organizationId]);
  return res.json({interventions:result.rows});
});

router.get('/resources', requireAuth, async (req: AuthRequest,res)=>{
  const allowed=req.permissions?.some((p)=>p==='*'||p==='resources:read'||p==='interventions:manage'||p==='interventions:assigned');
  if(!allowed)return res.status(403).json({detail:'Permission insuffisante'});
  const global=req.permissions?.some((p)=>p==='*'||p==='resources:read'||p==='interventions:manage');
  const result=global ? await query<any>(`SELECT ru.*,o.name organization_name FROM response_units ru JOIN organizations o ON o.id=ru.organization_id ORDER BY ru.updated_at DESC`)
    : await query<any>(`SELECT ru.*,o.name organization_name FROM response_units ru JOIN organizations o ON o.id=ru.organization_id WHERE ru.organization_id=$1 ORDER BY ru.updated_at DESC`,[req.organizationId]);
  return res.json({resources:result.rows});
});

router.patch('/resources/:id/location',requireAuth,async(req:AuthRequest,res)=>{
  const allowed=req.permissions?.some((p)=>p==='*'||p==='interventions:manage'||p==='interventions:update');
  if(!allowed)return res.status(403).json({detail:'Permission insuffisante'});
  const parsed=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),status:z.enum(['available','assigned','en_route','on_scene','transporting','maintenance','offline']).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Position invalide'});
  const global=req.permissions?.some((p)=>p==='*'||p==='interventions:manage');
  const result=await query<any>(`UPDATE response_units SET latitude=$1,longitude=$2,status=COALESCE($3,status),updated_at=NOW() WHERE id=$4 AND ($5::boolean OR organization_id=$6) RETURNING *`,[parsed.data.latitude,parsed.data.longitude,parsed.data.status||null,req.params.id,global||false,req.organizationId]);
  if(!result.rows[0])return res.status(404).json({detail:'Ressource introuvable ou interdite'});
  return res.json({resource:result.rows[0]});
});

router.post('/incidents/:id/assignments', requireAuth, requirePermission('interventions:manage'), async (req: AuthRequest,res)=>{
  const parsed=z.object({organization_id:z.string().uuid(),response_unit_id:z.string().uuid().optional(),assigned_to:z.string().optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Affectation invalide'});
  const d=parsed.data;
  const incident=await query<any>('SELECT status FROM incidents WHERE id=$1',[req.params.id]);
  if(!incident.rows[0])return res.status(404).json({detail:'Incident introuvable'});
  if(incident.rows[0].status!=='validated')return res.status(409).json({detail:'L’incident doit être validé avant affectation'});
  if(d.response_unit_id){
    const unit=await query<any>('SELECT organization_id,status FROM response_units WHERE id=$1',[d.response_unit_id]);
    if(!unit.rows[0]||unit.rows[0].organization_id!==d.organization_id)return res.status(400).json({detail:'Unité incompatible avec l’organisation'});
    if(unit.rows[0].status!=='available')return res.status(409).json({detail:'Unité indisponible'});
  }
  const result=await query<any>(`INSERT INTO interventions (incident_id,organization_id,response_unit_id,assigned_to) VALUES ($1,$2,$3,$4) RETURNING *`,[req.params.id,d.organization_id,d.response_unit_id||null,d.assigned_to||null]);
  await query(`UPDATE incidents SET status='assigned',updated_at=NOW() WHERE id=$1`,[req.params.id]);
  if(d.response_unit_id)await query(`UPDATE response_units SET status='assigned',updated_at=NOW() WHERE id=$1`,[d.response_unit_id]);
  await audit(req.userId,req.organizationId,'intervention.assigned','intervention',result.rows[0].id,{incident_id:req.params.id,organization_id:d.organization_id,response_unit_id:d.response_unit_id||null});
  await createNotification({organizationId:d.organization_id,recipientUserId:d.assigned_to||null,roles:['admin','supervisor','dispatcher','firefighter','ambulance_driver'],type:'intervention.assigned',title:'Nouvelle mission affectée',message:`Intervention ${result.rows[0].id}`,entityType:'intervention',entityId:result.rows[0].id});
  return res.status(201).json({intervention:result.rows[0]});
});

router.patch('/interventions/:id/status', requireAuth, async (req: AuthRequest,res)=>{
  const parsed=z.object({status:z.enum(['accepted','en_route','on_scene','patient_loaded','hospital_requested','to_hospital','arrived_hospital','completed','cancelled']),notes:z.string().max(2000).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Statut invalide'});
  const allowed=req.permissions?.some((p)=>p==='*'||p==='interventions:manage'||p==='interventions:update');
  if(!allowed)return res.status(403).json({detail:'Permission insuffisante'});
  const current=await query<any>(`SELECT status FROM interventions WHERE id=$1 AND ($2::boolean OR assigned_to=$3 OR organization_id=$4)`,[req.params.id,req.permissions?.some(p=>p==='*'||p==='interventions:manage')||false,req.userId,req.organizationId]);
  if(!current.rows[0])return res.status(404).json({detail:'Intervention introuvable ou interdite'});
  if(!canTransition(INTERVENTION_TRANSITIONS,current.rows[0].status,parsed.data.status))return res.status(409).json({detail:`Transition ${current.rows[0].status} -> ${parsed.data.status} interdite`});
  const result=await query<any>(`UPDATE interventions SET status=$1,notes=COALESCE($2,notes),accepted_at=CASE WHEN $1='accepted' THEN COALESCE(accepted_at,NOW()) ELSE accepted_at END,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE completed_at END,updated_at=NOW()
    WHERE id=$3 AND ($4::boolean OR assigned_to=$5 OR organization_id=$6) RETURNING *`,[parsed.data.status,parsed.data.notes||null,req.params.id,req.permissions?.some(p=>p==='*'||p==='interventions:manage')||false,req.userId,req.organizationId]);
  if(!result.rows[0])return res.status(404).json({detail:'Intervention introuvable ou interdite'});
  const incidentStatus:Record<string,string>={en_route:'en_route',on_scene:'on_scene',patient_loaded:'patient_loaded',to_hospital:'to_hospital',arrived_hospital:'arrived_hospital',completed:'completed',cancelled:'cancelled'};
  if(incidentStatus[parsed.data.status]) await query(`UPDATE incidents SET status=$1,updated_at=NOW() WHERE id=$2`,[incidentStatus[parsed.data.status],result.rows[0].incident_id]);
  if(['en_route','on_scene','to_hospital'].includes(parsed.data.status) && result.rows[0].response_unit_id) {
    const unitStatus=parsed.data.status==='to_hospital'?'transporting':parsed.data.status;
    await query(`UPDATE response_units SET status=$1,updated_at=NOW() WHERE id=$2`,[unitStatus,result.rows[0].response_unit_id]);
  }
  if(['completed','cancelled'].includes(parsed.data.status) && result.rows[0].response_unit_id) await query(`UPDATE response_units SET status='available',updated_at=NOW() WHERE id=$1`,[result.rows[0].response_unit_id]);
  await audit(req.userId,req.organizationId,'intervention.status_changed','intervention',req.params.id,{from:current.rows[0].status,to:parsed.data.status});
  return res.json({intervention:result.rows[0]});
});

router.post('/interventions/:id/admissions',requireAuth,async(req:AuthRequest,res)=>{
  const allowed=req.permissions?.some((p)=>p==='*'||p==='interventions:manage'||p==='interventions:update');
  if(!allowed)return res.status(403).json({detail:'Permission insuffisante'});
  const parsed=z.object({hospital_id:z.string().uuid(),patient_summary:z.record(z.any()).default({})}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Demande invalide'});
  const intervention=await query<any>('SELECT status,organization_id,assigned_to FROM interventions WHERE id=$1',[req.params.id]);
  if(!intervention.rows[0])return res.status(404).json({detail:'Intervention introuvable'});
  const global=req.permissions?.some((p)=>p==='*'||p==='interventions:manage');
  if(!global&&intervention.rows[0].organization_id!==req.organizationId&&intervention.rows[0].assigned_to!==req.userId)return res.status(403).json({detail:'Intervention interdite'});
  if(!['on_scene','patient_loaded'].includes(intervention.rows[0].status))return res.status(409).json({detail:'Le patient doit être pris en charge avant la demande hospitalière'});
  const facility=await query<any>(`SELECT id FROM organizations WHERE id=$1 AND active=true AND type IN ('hospital','clinic')`,[parsed.data.hospital_id]);
  if(!facility.rows[0])return res.status(400).json({detail:'Établissement hospitalier invalide'});
  const result=await query<any>(`INSERT INTO hospital_admission_requests(intervention_id,hospital_id,requested_by,patient_summary) VALUES($1,$2,$3,$4) RETURNING *`,[req.params.id,parsed.data.hospital_id,req.userId,parsed.data.patient_summary]);
  await query(`UPDATE interventions SET hospital_id=$1,status='hospital_requested',updated_at=NOW() WHERE id=$2`,[parsed.data.hospital_id,req.params.id]);
  await audit(req.userId,req.organizationId,'admission.requested','admission',result.rows[0].id,{intervention_id:req.params.id,hospital_id:parsed.data.hospital_id});
  await createNotification({organizationId:parsed.data.hospital_id,roles:['admin','supervisor','hospital_manager','hospital_agent'],type:'admission.requested',title:'Demande d’admission',message:`Intervention ${req.params.id}`,entityType:'admission',entityId:result.rows[0].id});
  return res.status(201).json({admission:result.rows[0]});
});

router.get('/admissions',requireAuth,async(req:AuthRequest,res)=>{
  const hospital=req.permissions?.includes('admissions:organization');
  const global=req.permissions?.some((p)=>p==='*'||p==='interventions:read'||p==='interventions:manage');
  if(!hospital&&!global)return res.status(403).json({detail:'Permission insuffisante'});
  const result=global ? await query<any>(`SELECT ar.*,i.incident_id,o.name hospital_name FROM hospital_admission_requests ar JOIN interventions i ON i.id=ar.intervention_id JOIN organizations o ON o.id=ar.hospital_id ORDER BY ar.updated_at DESC`)
    : await query<any>(`SELECT ar.*,i.incident_id,o.name hospital_name FROM hospital_admission_requests ar JOIN interventions i ON i.id=ar.intervention_id JOIN organizations o ON o.id=ar.hospital_id WHERE ar.hospital_id=$1 ORDER BY ar.updated_at DESC`,[req.organizationId]);
  return res.json({admissions:result.rows});
});

router.patch('/admissions/:id/status',requireAuth,requirePermission('admissions:organization'),async(req:AuthRequest,res)=>{
  const parsed=z.object({status:z.enum(['accepted','rejected','arrived','closed']),response_note:z.string().max(1000).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Décision invalide'});
  const result=await query<any>(`UPDATE hospital_admission_requests SET status=$1,response_note=$2,responded_by=$3,responded_at=COALESCE(responded_at,NOW()),updated_at=NOW() WHERE id=$4 AND hospital_id=$5 RETURNING *`,[parsed.data.status,parsed.data.response_note||null,req.userId,req.params.id,req.organizationId]);
  if(!result.rows[0])return res.status(404).json({detail:'Admission introuvable ou interdite'});
  const intervention=await query<any>(`SELECT incident_id,response_unit_id,organization_id,assigned_to FROM interventions WHERE id=$1`,[result.rows[0].intervention_id]);
  const linked=intervention.rows[0];
  if(parsed.data.status==='accepted') {
    await query(`UPDATE interventions SET status='to_hospital',hospital_id=$1,updated_at=NOW() WHERE id=$2`,[result.rows[0].hospital_id,result.rows[0].intervention_id]);
    if(linked) await query(`UPDATE incidents SET status='to_hospital',updated_at=NOW() WHERE id=$1`,[linked.incident_id]);
    if(linked?.response_unit_id) await query(`UPDATE response_units SET status='transporting',updated_at=NOW() WHERE id=$1`,[linked.response_unit_id]);
  }
  if(parsed.data.status==='arrived') {
    await query(`UPDATE interventions SET status='arrived_hospital',updated_at=NOW() WHERE id=$1`,[result.rows[0].intervention_id]);
    if(linked) await query(`UPDATE incidents SET status='arrived_hospital',updated_at=NOW() WHERE id=$1`,[linked.incident_id]);
  }
  if(parsed.data.status==='closed') {
    await query(`UPDATE interventions SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE id=$1`,[result.rows[0].intervention_id]);
    if(linked) await query(`UPDATE incidents SET status='completed',updated_at=NOW() WHERE id=$1`,[linked.incident_id]);
    if(linked?.response_unit_id) await query(`UPDATE response_units SET status='available',updated_at=NOW() WHERE id=$1`,[linked.response_unit_id]);
  }
  await createNotification({organizationId:linked?.organization_id,recipientUserId:linked?.assigned_to,roles:['admin','supervisor','dispatcher','firefighter','ambulance_driver'],type:'admission.responded',title:'Réponse hospitalière',message:`Admission ${parsed.data.status}`,entityType:'admission',entityId:result.rows[0].id});
  await audit(req.userId,req.organizationId,'admission.status_changed','admission',result.rows[0].id,{status:parsed.data.status});
  return res.json({admission:result.rows[0]});
});

router.get('/notifications',requireAuth,async(req:AuthRequest,res)=>{
  const result=await query<any>(`SELECT n.*,nr.read_at FROM operational_notifications n
    LEFT JOIN notification_receipts nr ON nr.notification_id=n.id AND nr.user_id=$1
    WHERE n.recipient_user_id=$1 OR n.organization_id=$2 OR n.recipient_roles && $3::text[] OR $4::boolean
    ORDER BY n.created_at DESC LIMIT 200`,[req.userId,req.organizationId,req.roles||[],req.roles?.includes('admin')||false]);
  return res.json({notifications:result.rows});
});

router.patch('/notifications/:id/read',requireAuth,async(req:AuthRequest,res)=>{
  const visible=await query<any>(`SELECT 1 FROM operational_notifications WHERE id=$1 AND (recipient_user_id=$2 OR organization_id=$3 OR recipient_roles && $4::text[] OR $5::boolean)`,[req.params.id,req.userId,req.organizationId,req.roles||[],req.roles?.includes('admin')||false]);
  if(!visible.rows[0])return res.status(404).json({detail:'Notification introuvable'});
  await query(`INSERT INTO notification_receipts(notification_id,user_id) VALUES($1,$2) ON CONFLICT(notification_id,user_id) DO UPDATE SET read_at=NOW()`,[req.params.id,req.userId]);
  return res.json({success:true});
});

router.get('/zem/applications', requireAuth, requirePermission('zem:approve'), async (_req,res)=>{
  const result=await query<any>(`SELECT za.*,u.phone,p.first_name,p.last_name FROM zem_driver_applications za JOIN users u ON u.id=za.user_id LEFT JOIN profiles p ON p.user_id=u.id ORDER BY za.created_at DESC`);
  return res.json({applications:result.rows});
});

router.patch('/zem/applications/:id', requireAuth, requirePermission('zem:approve'), async (req:AuthRequest,res)=>{
  const parsed=z.object({status:z.enum(['approved','rejected']),review_note:z.string().max(1000).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Décision invalide'});
  const result=await query<any>(`UPDATE zem_driver_applications SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$4 RETURNING *`,[parsed.data.status,parsed.data.review_note||null,req.userId,req.params.id]);
  if(!result.rows[0])return res.status(404).json({detail:'Demande introuvable'});
  if(parsed.data.status==='approved') {
    await query(`INSERT INTO user_roles(user_id,role_key,organization_id,granted_by) VALUES ($1,'zem_driver',NULL,$2) ON CONFLICT DO NOTHING`,[result.rows[0].user_id,req.userId]);
    await query(`UPDATE profiles SET is_zem=true,updated_at=NOW() WHERE user_id=$1`,[result.rows[0].user_id]);
  } else {
    await query(`DELETE FROM user_roles WHERE user_id=$1 AND role_key='zem_driver' AND organization_id IS NULL`,[result.rows[0].user_id]);
    await query(`UPDATE profiles SET is_zem=false,updated_at=NOW() WHERE user_id=$1`,[result.rows[0].user_id]);
  }
  return res.json({application:result.rows[0]});
});

router.get('/audit', requireAuth, requirePermission('admin:manage'), async (_req,res)=>{
  const result=await query<any>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
  return res.json({logs:result.rows});
});

export default router;
