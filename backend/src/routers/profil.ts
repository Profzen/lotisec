import { Router } from 'express';
import { z } from 'zod';
import { pool, query } from '../database';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(3),
  relation: z.string().optional().default('Proche')
});

const profilSchema = z.object({
  profile_type: z.string().optional().default('adult'),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  birth_date: z.string().optional().default('01/01/2000'),
  gender: z.string().optional().default('Masculin'),
  nationality: z.string().optional().default('Togo'),
  document_type: z.string().optional().default('Non renseigne'),
  document_number: z.string().optional().default('0000'),
  blood_type: z.string().optional().default('NC'),
  height: z.number().positive().max(260).nullable().optional().default(null),
  weight: z.number().positive().max(500).nullable().optional().default(null),
  allergies: z.string().optional().default(''),
  conditions: z.string().optional().default(''),
  medications: z.string().optional().default(''),
  surgeries: z.string().optional().default(''),
  disabilities: z.string().optional().default(''),
  doctor_name: z.string().optional().default(''),
  doctor_phone: z.string().optional().default(''),
  access_pin: z.string().regex(/^\d{4,6}$/,'Le PIN doit contenir 4 à 6 chiffres').optional(),
  has_vehicle: z.boolean().optional().default(false),
  vehicle_type: z.string().optional().default(''),
  plate: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  emergency_contacts: z.array(contactSchema).optional().default([])
});

router.get(['/', '/me'], requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId as string;
  const existing = await query<any>(
    'SELECT * FROM profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ detail: 'Profil introuvable' });
  }
  const {access_code,access_code_hash,...profile} = existing.rows[0];
  const contacts = await query<any>(
    'SELECT name, phone, relation FROM emergency_contacts WHERE profile_id = $1 ORDER BY name ASC',
    [profile.id]
  );
  return res.json({
    profile:{...profile,pin_configured:Boolean(access_code_hash||access_code)},
    qr_token: profile.qr_token,
    emergency_contacts: contacts.rows
  });
});

router.post(['/', ''], requireAuth, async (req: AuthRequest, res) => {
  const parsed = profilSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const userId = req.userId as string;
  const data = parsed.data;
  if(!pool)return res.status(503).json({detail:'Base de données indisponible'});
  const client=await pool.connect();
  try {
  await client.query('BEGIN');

  const existing = await client.query<{ id: string; qr_token: string; access_code_hash:string|null; access_code:string|null }>(
    'SELECT id, qr_token, access_code_hash, access_code FROM profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  let profileId: string;
  let qrToken: string;
  if(existing.rows.length===0&&!data.access_pin){await client.query('ROLLBACK');return res.status(400).json({detail:'Définissez un PIN personnel de 4 à 6 chiffres'});}
  const accessCodeHash=data.access_pin ? await bcrypt.hash(data.access_pin,12) : null;

  if (existing.rows.length > 0) {
    profileId = existing.rows[0].id;
    qrToken = existing.rows[0].qr_token || uuidv4().slice(0, 8).toUpperCase();

    await client.query(
      `UPDATE profiles SET
        profile_type = $1,
        first_name = $2,
        last_name = $3,
        birth_date = $4,
        gender = $5,
        nationality = $6,
        document_type = $7,
        document_number = $8,
        blood_type = $9,
        allergies = $10,
        conditions = $11,
        medications = $12,
        surgeries = $13,
        disabilities = $14,
        has_vehicle = $15,
        vehicle_type = $16,
        plate = $17,
        brand = $18,
        model = $19,
        qr_token = $20,
        updated_at = NOW()
      WHERE id = $21`,
      [
        data.profile_type,
        data.first_name,
        data.last_name,
        data.birth_date,
        data.gender,
        data.nationality,
        data.document_type,
        data.document_number,
        data.blood_type,
        data.allergies,
        data.conditions,
        data.medications,
        data.surgeries,
        data.disabilities,
        data.has_vehicle,
        data.vehicle_type,
        data.plate,
        data.brand,
        data.model,
        qrToken,
        profileId
      ]
    );
    if(accessCodeHash)await client.query('UPDATE profiles SET access_code_hash=$1,access_code=NULL,pin_updated_at=NOW() WHERE id=$2',[accessCodeHash,profileId]);
  } else {
    profileId = uuidv4();
    qrToken = uuidv4().slice(0, 8).toUpperCase();

    await client.query(
      `INSERT INTO profiles (
        id, user_id, qr_token, profile_type, first_name, last_name, birth_date,
        gender, nationality, document_type, document_number, blood_type,
        allergies, conditions, medications, surgeries, disabilities,
        has_vehicle, vehicle_type, plate, brand, model, access_code_hash, pin_updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24
      )`,
      [
        profileId,
        userId,
        qrToken,
        data.profile_type,
        data.first_name,
        data.last_name,
        data.birth_date,
        data.gender,
        data.nationality,
        data.document_type,
        data.document_number,
        data.blood_type,
        data.allergies,
        data.conditions,
        data.medications,
        data.surgeries,
        data.disabilities,
        data.has_vehicle,
        data.vehicle_type,
        data.plate,
        data.brand,
        data.model,
        accessCodeHash,
        new Date()
      ]
    );
  }

  await client.query(
    'UPDATE profiles SET height=$1, weight=$2, doctor_name=$3, doctor_phone=$4, updated_at=NOW() WHERE id=$5',
    [data.height, data.weight, data.doctor_name || null, data.doctor_phone || null, profileId]
  );

  await client.query('DELETE FROM emergency_contacts WHERE profile_id = $1', [profileId]);

  for (const c of data.emergency_contacts) {
    await client.query(
      'INSERT INTO emergency_contacts (id, profile_id, name, phone, relation) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), profileId, c.name, c.phone, c.relation || 'Proche']
    );
  }

  const changedFields=Object.keys(data).filter(key=>key!=='access_pin'&&key!=='emergency_contacts');
  await client.query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,'profile',$4,$5)`,[req.userId,req.organizationId,existing.rows.length?'medical_profile.updated':'medical_profile.created',profileId,{changed_fields:changedFields,emergency_contacts_count:data.emergency_contacts.length,pin_changed:Boolean(data.access_pin)}]);
  await client.query('COMMIT');
  return res.json({
    status: existing.rows.length > 0 ? 'updated' : 'created',
    message: existing.rows.length > 0 ? 'Profil mis a jour avec succes' : 'Profil cree avec succes',
    qr_token: qrToken
  });
  } catch(error) {
    await client.query('ROLLBACK');throw error;
  } finally {client.release();}
});

router.put('/pin',requireAuth,async(req:AuthRequest,res)=>{
  const parsed=z.object({pin:z.string().regex(/^\d{4,6}$/,'Le PIN doit contenir 4 à 6 chiffres')}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:parsed.error.issues[0]?.message||'PIN invalide'});
  const hash=await bcrypt.hash(parsed.data.pin,12);
  const result=await query<any>('UPDATE profiles SET access_code_hash=$1,access_code=NULL,pin_updated_at=NOW(),updated_at=NOW() WHERE user_id=$2 RETURNING id',[hash,req.userId]);
  if(!result.rows[0])return res.status(404).json({detail:'Profil introuvable'});
  await query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'medical_pin.updated','profile',$3,$4)`,[req.userId,req.organizationId,result.rows[0].id,{method:'authenticated_owner'}]);
  return res.json({status:'updated',pin_configured:true});
});

router.delete('/medical-data',requireAuth,async(req:AuthRequest,res)=>{
  const parsed=z.object({password:z.string().min(8)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({detail:'Mot de passe requis pour effacer la fiche médicale'});
  const account=await query<any>('SELECT password FROM users WHERE id=$1',[req.userId]);
  if(!account.rows[0]||!await bcrypt.compare(parsed.data.password,account.rows[0].password))return res.status(403).json({detail:'Mot de passe incorrect'});
  if(!pool)return res.status(503).json({detail:'Base de données indisponible'});const client=await pool.connect();
  try{await client.query('BEGIN');const profile=await client.query<any>('SELECT id FROM profiles WHERE user_id=$1 FOR UPDATE',[req.userId]);if(!profile.rows[0]){await client.query('ROLLBACK');return res.status(404).json({detail:'Profil introuvable'});}const profileId=profile.rows[0].id;
    await client.query(`UPDATE profiles SET blood_type='NC',height=NULL,weight=NULL,allergies='',conditions='',medications='',surgeries='',disabilities='',doctor_name=NULL,doctor_phone=NULL,has_vehicle=false,vehicle_type='',plate='',brand='',model='',access_code=NULL,access_code_hash=NULL,pin_updated_at=NULL,updated_at=NOW() WHERE id=$1`,[profileId]);
    await client.query('DELETE FROM emergency_contacts WHERE profile_id=$1',[profileId]);
    await client.query(`INSERT INTO audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'medical_profile.cleared','profile',$3,$4)`,[req.userId,req.organizationId,profileId,{owner_confirmed:true}]);await client.query('COMMIT');return res.json({status:'cleared',pin_configured:false});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});

router.get('/scan/:token', optionalAuth, async (req: AuthRequest, res) => {
  const token = req.params.token;

  const result = await query<any>(
    `SELECT p.*, u.phone
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.qr_token = $1
     LIMIT 1`,
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ detail: 'Profil introuvable' });
  }

  const profile = result.rows[0];
  return res.json({
    id: profile.id,
    qr_token: profile.qr_token,
    identity: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      birth_date: profile.birth_date,
      gender: profile.gender,
      nationality: profile.nationality
    },
    emergency_contacts: [],
    access_level: 'public',
    verification_required:true
  });
});

export default router;
