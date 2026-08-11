import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, optionalAuth, requireAuth, requirePermission } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

const verifySchema = z.object({
  token: z.string().min(3),
  pin: z.string().optional().default(''),
  authority_type: z.string().optional().default('emergency_unit'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

const scanSchema = z.object({
  token: z.string().min(3),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scanner_ip: z.string().optional(),
  alert_sent: z.boolean().optional().default(false)
});

const MASTER_CODES: Record<string, string> = {
  POL1717: 'Police Nationale',
  AMBU1818: 'Service d\'Ambulance',
  POMP2626: 'Sapeurs-Pompiers',
  MEDC3737: 'Corps Medical'
};

router.post('/verify', optionalAuth, async (req: AuthRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const cleanPin = parsed.data.pin.trim().toUpperCase();

  const profileResult = await query<any>(
    'SELECT * FROM profiles WHERE qr_token = $1 OR id = $1 LIMIT 1',
    [parsed.data.token]
  );

  if (profileResult.rows.length === 0) {
    return res.status(404).json({ detail: 'Profil introuvable' });
  }

  const profile = profileResult.rows[0];
  const professionalRole = req.roles?.find((role) => ['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent'].includes(role));
  const owner=req.userId===profile.user_id;
  const scannerIp=req.ip||req.socket.remoteAddress||'unknown';
  if(!professionalRole&&!owner){
    const recentFailures=await query<{count:string}>(`SELECT COUNT(*)::text count FROM scan_access_events WHERE profile_id=$1 AND success=false AND scanner_ip=$2 AND created_at>NOW()-INTERVAL '10 minutes'`,[profile.id,scannerIp]);
    if(Number(recentFailures.rows[0]?.count||0)>=5)return res.status(429).json({detail:'Trop de tentatives. Réessayez dans 10 minutes.'});
  }
  let authorityName:string|null=owner?'Propriétaire':professionalRole||null;
  let accessMethod=owner?'owner_session':professionalRole?'professional_session':'';

  if(!authorityName&&cleanPin&&profile.access_code_hash&&await bcrypt.compare(cleanPin,profile.access_code_hash)){
    authorityName='PIN citoyen';accessMethod='citizen_pin';
  }
  if(!authorityName&&cleanPin&&profile.access_code&&cleanPin===String(profile.access_code).trim().toUpperCase()){
    authorityName='PIN citoyen';accessMethod='citizen_pin_legacy';
    const migratedHash=await bcrypt.hash(cleanPin,12);
    await query('UPDATE profiles SET access_code_hash=$1,access_code=NULL,pin_updated_at=NOW() WHERE id=$2',[migratedHash,profile.id]);
  }
  if(!authorityName&&cleanPin){
    const emergencyCodes=await query<any>(`SELECT e.id,e.organization_id,e.code_hash,e.label,o.name organization_name
      FROM organization_emergency_access_codes e JOIN organizations o ON o.id=e.organization_id
      WHERE e.revoked_at IS NULL AND e.expires_at>NOW() AND o.active=true`);
    for(const emergencyCode of emergencyCodes.rows){
      if(await bcrypt.compare(cleanPin,emergencyCode.code_hash)){
        authorityName=`${emergencyCode.label} · ${emergencyCode.organization_name}`;accessMethod='organization_emergency_code';
        await query('UPDATE organization_emergency_access_codes SET last_used_at=NOW() WHERE id=$1',[emergencyCode.id]);
        break;
      }
    }
  }
  if(!authorityName&&process.env.ENABLE_DEMO_MEDICAL_CODES==='true'&&MASTER_CODES[cleanPin]){
    authorityName=MASTER_CODES[cleanPin];accessMethod='demo_master_code';
  }

  if (!authorityName) {
    await query(`INSERT INTO scan_access_events(profile_id,actor_id,actor_role,organization_id,authority,access_level,latitude,longitude,success,access_method,denial_reason,scanner_ip)
      VALUES($1,$2,$3,$4,'Refusé','none',$5,$6,false,'invalid_credential','invalid_or_missing_credential',$7)`,[
        profile.id,req.userId||null,professionalRole||null,req.organizationId||null,parsed.data.latitude??null,parsed.data.longitude??null,scannerIp
      ]);
    return res.status(403).json({ detail: 'Accès refusé : authentification professionnelle ou PIN valide requis' });
  }

  const contacts = await query<any>(
    'SELECT name, phone, relation FROM emergency_contacts WHERE profile_id = $1',
    [profile.id]
  );
  if (req.userId) {
    await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'medical_profile.read','profile',$3,$4)`,
      [req.userId,req.organizationId,profile.id,{authority:authorityName}]);
  }
  await query(`INSERT INTO scan_access_events(profile_id,actor_id,actor_role,organization_id,authority,access_level,latitude,longitude,success,access_method,scanner_ip)
    VALUES($1,$2,$3,$4,$5,'medical_emergency',$6,$7,true,$8,$9)`,[
      profile.id,req.userId||null,professionalRole||null,req.organizationId||null,authorityName,
      parsed.data.latitude??null,parsed.data.longitude??null,accessMethod,scannerIp
    ]);

  return res.json({
    status: 'success',
    authority: authorityName,
    identity: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      birth_date: profile.birth_date || 'Non renseignee',
      gender: profile.gender || 'NC',
      nationality: profile.nationality || 'Togolaise'
    },
    medical: {
      blood_type: profile.blood_type || 'NC',
      height: profile.height ?? profile.taille ?? null,
      weight: profile.weight ?? profile.poids ?? null,
      allergies: profile.allergies || 'Aucune',
      conditions: profile.conditions || 'Aucune',
      medications: profile.medications || 'Aucun',
      disabilities: profile.disabilities || 'Aucun',
      doctor_name: profile.doctor_name ?? profile.medecin_nom ?? null,
      doctor_phone: profile.doctor_phone ?? profile.medecin_telephone ?? null
    },
    vehicle: profile.has_vehicle ? {
      has_vehicle: true,
      type: profile.vehicle_type || null,
      plate: profile.plate || null,
      brand: profile.brand || null,
      model: profile.model || null
    } : null,
    emergency_contacts: contacts.rows,
    audit: {
      authority: authorityName,
      access_method:accessMethod,
      token: parsed.data.token.slice(0, 8)
    }
  });
});

router.post('/', async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const profileResult = await query<{ id: string }>('SELECT id FROM profiles WHERE qr_token = $1 LIMIT 1', [parsed.data.token]);
  if (profileResult.rows.length === 0) {
    return res.status(404).json({ detail: 'Profil introuvable' });
  }

  const profileId = profileResult.rows[0].id;

  await query(
    `INSERT INTO scans (id, profile_id, latitude, longitude, scanner_ip, alert_sent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      uuidv4(),
      profileId,
      parsed.data.latitude ?? null,
      parsed.data.longitude ?? null,
      parsed.data.scanner_ip ?? null,
      parsed.data.alert_sent
    ]
  );

  return res.json({ status: 'success' });
});

router.get('/historique', requireAuth, requirePermission('reports:read'), async (_req, res) => {
  const scans = await query<any>(
    `SELECT s.id, s.latitude, s.longitude, s.created_at, p.qr_token, p.first_name, p.last_name
     FROM scans s
     JOIN profiles p ON p.id = s.profile_id
     ORDER BY s.created_at DESC
     LIMIT 200`
  );

  return res.json({ scans: scans.rows });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const page=Math.max(1,Number(req.query.page)||1);
  const pageSize=Math.min(50,Math.max(1,Number(req.query.page_size)||20));
  const profile=await query<any>('SELECT id FROM profiles WHERE user_id=$1 LIMIT 1',[req.userId]);
  if(!profile.rows[0]) return res.json({items:[],page,page_size:pageSize,total:0});
  const count=await query<{total:string}>('SELECT COUNT(*)::text total FROM scan_access_events WHERE profile_id=$1',[profile.rows[0].id]);
  const items=await query<any>(`SELECT id,authority,actor_role,access_level,latitude,longitude,success,created_at
    FROM scan_access_events WHERE profile_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [profile.rows[0].id,pageSize,(page-1)*pageSize]);
  return res.json({items:items.rows,page,page_size:pageSize,total:Number(count.rows[0]?.total||0)});
});

export default router;
