import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../database';
import { broadcast } from '../utils/wsManager';

const router = Router();

const createSchema = z.object({
  user_id: z.string().optional(),
  qr_token: z.string().optional(),
  prenom: z.string().optional(),
  nom: z.string().optional(),
  groupe_sanguin: z.string().optional(),
  electrophorese: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  adresse: z.string().optional(),
  vehicle_type: z.string().optional().default('moto')
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const data = parsed.data;
  const id = uuidv4();

  const saved = await query<any>(
    `INSERT INTO alerte_events (
      id, user_id, qr_token, prenom, nom, groupe_sanguin, electrophorese,
      latitude, longitude, adresse, vehicle_type, statut
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12
    ) RETURNING *`,
    [
      id,
      data.user_id ?? null,
      data.qr_token ?? null,
      data.prenom ?? 'Inconnu',
      data.nom ?? '',
      data.groupe_sanguin ?? '?',
      data.electrophorese ?? null,
      data.latitude,
      data.longitude,
      data.adresse ?? 'Position GPS',
      data.vehicle_type ?? 'moto',
      'active'
    ]
  );

  const a = saved.rows[0];
  const message = {
    type: 'NOUVELLE_ALERTE',
    id: String(a.id),
    prenom: a.prenom,
    nom: a.nom,
    groupe_sanguin: a.groupe_sanguin,
    electrophorese: a.electrophorese,
    latitude: a.latitude,
    longitude: a.longitude,
    adresse: a.adresse,
    vehicle_type: a.vehicle_type,
    statut: a.statut,
    timestamp: a.timestamp,
    minutes_ecoulees: 0,
    contacts: []
  };

  broadcast(message);
  return res.json({ success: true, alerte_id: String(a.id) });
});

router.get('/', async (_req, res) => {
  const rows = await query<any>(
    `SELECT id, prenom, nom, groupe_sanguin, electrophorese, latitude, longitude,
            adresse, vehicle_type, statut, timestamp
     FROM alerte_events
     WHERE statut != 'resolue'
     ORDER BY timestamp DESC`
  );

  const result = rows.rows.map((a: any) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(a.timestamp).getTime()) / 60000));
    return {
      ...a,
      id: String(a.id),
      minutes_ecoulees: minutes,
      contacts: []
    };
  });

  return res.json(result);
});

router.put('/:alerteId/prendre-en-charge', async (req, res) => {
  const alerteId = req.params.alerteId;
  const updated = await query(
    'UPDATE alerte_events SET statut = $1 WHERE id = $2',
    ['en_cours', alerteId]
  );

  if (updated.rowCount === 0) {
    return res.status(404).json({ error: 'Alerte introuvable' });
  }

  broadcast({ type: 'ALERTE_MISE_A_JOUR', id: alerteId, statut: 'en_cours' });
  return res.json({ success: true });
});

router.put('/:alerteId/resoudre', async (req, res) => {
  const alerteId = req.params.alerteId;
  const updated = await query(
    'UPDATE alerte_events SET statut = $1, resolved_at = NOW() WHERE id = $2',
    ['resolue', alerteId]
  );

  if (updated.rowCount === 0) {
    return res.status(404).json({ error: 'Alerte introuvable' });
  }

  broadcast({ type: 'ALERTE_RESOLUE', id: alerteId, statut: 'resolue' });
  return res.json({ success: true });
});

export default router;
