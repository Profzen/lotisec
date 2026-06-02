import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const verifySchema = z.object({
  token: z.string().min(3),
  pin: z.string().min(2),
  authority_type: z.string().optional().default('emergency_unit')
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

router.post('/verify', async (req, res) => {
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
  let authorityName = MASTER_CODES[cleanPin] || null;

  if (!authorityName) {
    const userPin = String(profile.access_code || '1234').trim().toUpperCase();
    if (cleanPin === userPin) {
      authorityName = 'Acces Prive';
    }
  }

  if (!authorityName) {
    return res.status(403).json({ detail: 'CODE INVALIDE' });
  }

  const contacts = await query<any>(
    'SELECT name, phone, relation FROM emergency_contacts WHERE profile_id = $1',
    [profile.id]
  );

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
      allergies: profile.allergies || 'Aucune',
      conditions: profile.conditions || 'Aucune',
      medications: profile.medications || 'Aucun',
      disabilities: profile.disabilities || 'Aucun'
    },
    emergency_contacts: contacts.rows,
    audit: {
      authority: authorityName,
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

router.get('/historique', async (_req, res) => {
  const scans = await query<any>(
    `SELECT s.id, s.latitude, s.longitude, s.created_at, p.qr_token, p.first_name, p.last_name
     FROM scans s
     JOIN profiles p ON p.id = s.profile_id
     ORDER BY s.created_at DESC
     LIMIT 200`
  );

  return res.json({ scans: scans.rows });
});

export default router;
