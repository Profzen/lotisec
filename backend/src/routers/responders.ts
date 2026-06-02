import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';

const router = Router();

const updateSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  disponible: z.boolean().optional(),
  score: z.number().optional()
});

router.get('/', async (_req, res) => {
  const rows = await query<any>('SELECT * FROM responders ORDER BY updated_at DESC LIMIT 200');
  return res.json(rows.rows);
});

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const id = req.params.id;
  const d = parsed.data;

  const updated = await query<any>(
    `UPDATE responders
     SET latitude = COALESCE($1, latitude),
         longitude = COALESCE($2, longitude),
         disponible = COALESCE($3, disponible),
         score = COALESCE($4, score),
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [d.latitude ?? null, d.longitude ?? null, d.disponible ?? null, d.score ?? null, id]
  );

  if (updated.rows.length === 0) {
    return res.status(404).json({ detail: 'Responder introuvable' });
  }

  return res.json(updated.rows[0]);
});

export default router;
