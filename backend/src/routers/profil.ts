import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

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
  allergies: z.string().optional().default(''),
  conditions: z.string().optional().default(''),
  medications: z.string().optional().default(''),
  surgeries: z.string().optional().default(''),
  disabilities: z.string().optional().default(''),
  has_vehicle: z.boolean().optional().default(false),
  vehicle_type: z.string().optional().default(''),
  plate: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  model: z.string().optional().default(''),
  emergency_contacts: z.array(contactSchema).optional().default([])
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = profilSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const userId = req.userId as string;
  const data = parsed.data;

  const existing = await query<{ id: string; qr_token: string }>(
    'SELECT id, qr_token FROM profiles WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  let profileId: string;
  let qrToken: string;

  if (existing.rows.length > 0) {
    profileId = existing.rows[0].id;
    qrToken = existing.rows[0].qr_token;

    await query(
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
        updated_at = NOW()
      WHERE id = $20`,
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
        profileId
      ]
    );
  } else {
    profileId = uuidv4();
    qrToken = uuidv4().slice(0, 8).toUpperCase();

    await query(
      `INSERT INTO profiles (
        id, user_id, qr_token, profile_type, first_name, last_name, birth_date,
        gender, nationality, document_type, document_number, blood_type,
        allergies, conditions, medications, surgeries, disabilities,
        has_vehicle, vehicle_type, plate, brand, model, access_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23
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
        '1234'
      ]
    );
  }

  await query('DELETE FROM emergency_contacts WHERE profile_id = $1', [profileId]);

  for (const c of data.emergency_contacts) {
    await query(
      'INSERT INTO emergency_contacts (id, profile_id, name, phone, relation) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), profileId, c.name, c.phone, c.relation || 'Proche']
    );
  }

  return res.json({
    status: existing.rows.length > 0 ? 'updated' : 'created',
    message: existing.rows.length > 0 ? 'Profil mis a jour avec succes' : 'Profil cree avec succes',
    qr_token: qrToken
  });
});

router.get('/scan/:token', async (req, res) => {
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
  const contacts = await query<any>(
    'SELECT name, phone, relation FROM emergency_contacts WHERE profile_id = $1 ORDER BY name ASC',
    [profile.id]
  );

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
    medical: {
      blood_type: profile.blood_type,
      allergies: profile.allergies,
      conditions: profile.conditions,
      medications: profile.medications,
      disabilities: profile.disabilities
    },
    emergency_contacts: contacts.rows
  });
});

export default router;
