import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  user_id: z.string().optional(),
  qr_token: z.string().optional(),
  vehicle_type: z.string().optional().default('moto')
});

const updateSchema = z.object({
  severity: z.string().optional(),
  road_type: z.string().optional(),
  cause_probable: z.string().optional(),
  resolved: z.boolean().optional()
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const data = parsed.data;
  const id = uuidv4();
  const now = new Date();

  const saved = await query<any>(
    `INSERT INTO accident_events (
      id, user_id, qr_token, latitude, longitude, zone_name,
      hour_of_day, day_of_week, vehicle_type, weather, severity,
      is_hotspot, resolved
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13
    ) RETURNING *`,
    [
      id,
      data.user_id ?? null,
      data.qr_token ?? null,
      data.latitude,
      data.longitude,
      'Lome, Togo',
      now.getHours(),
      (now.getDay() + 6) % 7,
      data.vehicle_type,
      'inconnu',
      'unknown',
      false,
      false
    ]
  );

  return res.json(saved.rows[0]);
});

router.get('/geojson', requireAuth, requirePermission('incidents:read'), async (req, res) => {
  const days = Number(req.query.days || 30);
  const rows = await query<any>(
    `SELECT *
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval
     ORDER BY timestamp DESC`,
    [days]
  );

  const features = rows.rows.map((a: any) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [a.longitude, a.latitude]
    },
    properties: {
      id: String(a.id),
      zone_name: a.zone_name,
      timestamp: a.timestamp,
      hour_of_day: a.hour_of_day,
      day_of_week: a.day_of_week,
      vehicle_type: a.vehicle_type,
      severity: a.severity,
      road_type: a.road_type,
      weather: a.weather,
      cause_probable: a.cause_probable,
      is_hotspot: a.is_hotspot
    }
  }));

  return res.json({ type: 'FeatureCollection', features });
});

router.get('/heatmap', requireAuth, requirePermission('incidents:read'), async (req, res) => {
  const days = Number(req.query.days || 90);
  const rows = await query<any>(
    `SELECT latitude, longitude, severity
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval`,
    [days]
  );

  const weights: Record<string, number> = {
    fatal: 1.0,
    serious: 0.6,
    minor: 0.3,
    unknown: 0.2
  };

  const points = rows.rows.map((r: any) => [r.latitude, r.longitude, weights[r.severity || 'unknown'] || 0.2]);
  return res.json({ points, total: points.length });
});

router.get('/hotspots', requireAuth, requirePermission('incidents:read'), async (_req, res) => {
  const rows = await query<any>(
    `SELECT
      ROUND(latitude::numeric, 2) AS lat,
      ROUND(longitude::numeric, 2) AS lng,
      COUNT(*) AS nb_accidents,
      CASE
        WHEN COUNT(*) >= 10 THEN 'CRITIQUE'
        WHEN COUNT(*) >= 5 THEN 'ELEVE'
        ELSE 'MODERE'
      END AS niveau
    FROM accident_events
    WHERE timestamp > NOW() - INTERVAL '90 days'
    GROUP BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2)
    HAVING COUNT(*) >= 2
    ORDER BY nb_accidents DESC
    LIMIT 50`
  );

  return res.json(rows.rows);
});

router.get('/stats', requireAuth, requirePermission('reports:read'), async (req, res) => {
  const days = Number(req.query.days || 30);

  const total = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval`,
    [days]
  );

  const byVehicle = await query<any>(
    `SELECT vehicle_type AS type, COUNT(*)::int AS count
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval
     GROUP BY vehicle_type
     ORDER BY count DESC`,
    [days]
  );

  const bySeverity = await query<any>(
    `SELECT severity, COUNT(*)::int AS count
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval
     GROUP BY severity
     ORDER BY count DESC`,
    [days]
  );

  return res.json({
    total: Number(total.rows[0]?.total || 0),
    by_vehicle: byVehicle.rows,
    by_severity: bySeverity.rows
  });
});

router.put('/:accidentId', requireAuth, requirePermission('incidents:manage'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const id = req.params.accidentId;
  const data = parsed.data;

  const updated = await query<any>(
    `UPDATE accident_events
     SET severity = COALESCE($1, severity),
         road_type = COALESCE($2, road_type),
         cause_probable = COALESCE($3, cause_probable),
         resolved = COALESCE($4, resolved),
         resolved_at = CASE WHEN $4 = true THEN NOW() ELSE resolved_at END
     WHERE id = $5
     RETURNING *`,
    [
      data.severity ?? null,
      data.road_type ?? null,
      data.cause_probable ?? null,
      data.resolved ?? null,
      id
    ]
  );

  if (updated.rows.length === 0) {
    return res.status(404).json({ detail: 'Accident introuvable' });
  }

  return res.json(updated.rows[0]);
});

export default router;
