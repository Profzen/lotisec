import { Router } from 'express';
import { query } from '../database';

const router = Router();

router.get('/heatmap', async (req, res) => {
  const days = Number(req.query.days || 90);
  const rows = await query<any>(
    `SELECT latitude, longitude, severity
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval`,
    [days]
  );

  const points = rows.rows.map((r: any) => [r.latitude, r.longitude, 1]);
  return res.json({ points, total: points.length });
});

router.get('/hotspots', async (_req, res) => {
  const rows = await query<any>(
    `SELECT
      ROUND(latitude::numeric, 2) AS lat,
      ROUND(longitude::numeric, 2) AS lng,
      COUNT(*)::int AS nb_accidents,
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

router.get('/hopital-proche', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ detail: 'lat et lng sont requis' });
  }

  const rows = await query<any>(
    `SELECT id, name, type, address, phone, urgences, latitude, longitude,
            ROUND(ST_Distance(
              location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )::numeric / 1000, 2) AS distance_km
     FROM medical_facilities
     ORDER BY distance_km
     LIMIT 50`,
    [lng, lat]
  );

  return res.json(rows.rows);
});

router.get('/stats', async (req, res) => {
  const days = Number(req.query.days || 30);
  const total = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval`,
    [days]
  );

  return res.json({ total: Number(total.rows[0]?.total || 0) });
});

router.get('/accidents-zone', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const rayonKm = Number(req.query.rayon_km || 1);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ detail: 'lat et lng sont requis' });
  }

  const rows = await query<any>(
    `SELECT *
     FROM accident_events
     WHERE ST_DWithin(
       ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
       $3 * 1000
     )
     ORDER BY timestamp DESC`,
    [lng, lat, rayonKm]
  );

  return res.json(rows.rows);
});

router.get('/rapport', async (req, res) => {
  const days = Number(req.query.days || 30);
  const rows = await query<any>(
    `SELECT id, latitude, longitude, zone_name, timestamp, vehicle_type, severity
     FROM accident_events
     WHERE timestamp >= NOW() - ($1::text || ' days')::interval
     ORDER BY timestamp DESC`,
    [days]
  );
  return res.json({ generated_at: new Date().toISOString(), items: rows.rows });
});

export default router;
