import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const createSchema = z.object({
  user_id: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  type_danger: z.string().optional().default('route_degradee'),
  description: z.string().optional().default('')
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const d = parsed.data;
  const id = uuidv4();

  const rows = await query<any>(
    `INSERT INTO road_reports (
      id, user_id, latitude, longitude, type_danger, description,
      statut, recompense, recompense_versee
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9
    ) RETURNING *`,
    [id, d.user_id ?? null, d.latitude, d.longitude, d.type_danger, d.description, 'en_attente', 150, false]
  );

  return res.json(rows.rows[0]);
});

router.get('/', async (_req, res) => {
  const rows = await query<any>('SELECT * FROM road_reports ORDER BY timestamp DESC LIMIT 500');
  return res.json(rows.rows);
});

export default router;
