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
  const type = String(req.query.type || 'tous');
  const search = String(req.query.q || '').trim();
  const emergencies = String(req.query.urgences || '') === 'true';
  const maxDistance = Math.min(250, Math.max(1, Number(req.query.rayon_km || 100)));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ detail: 'lat et lng sont requis' });
  }

  const rows = await query<any>(
    `SELECT id, name, type, address, phone, urgences, latitude, longitude,source,source_id,last_verified_at,verified,services,opening_hours,emergency_level,
            ROUND(ST_Distance(
              location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )::numeric / 1000, 2) AS distance_km
     FROM medical_facilities
     WHERE active=true
       AND ($3='tous' OR type=$3)
       AND ($4='' OR name ILIKE '%'||$4||'%' OR address ILIKE '%'||$4||'%')
       AND ($5=false OR urgences=true)
       AND ST_DWithin(location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$6*1000)
     ORDER BY distance_km
     LIMIT 50`,
    [lng, lat,type,search,emergencies,maxDistance]
  );
  if(!rows.rows.length)return res.json([]);
  try{
    const coordinates=[[lng,lat],...rows.rows.map((row:any)=>[row.longitude,row.latitude])].map(pair=>pair.join(',')).join(';');
    const response=await fetch(`https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&annotations=duration`,{signal:AbortSignal.timeout(4500),headers:{'User-Agent':'LOTISEC/1.0 (medical directory)'}});
    if(response.ok){const matrix:any=await response.json();rows.rows.forEach((row:any,index:number)=>{const seconds=matrix.durations?.[0]?.[index+1];row.eta_seconds=Number.isFinite(seconds)?Math.round(seconds):null;});}
  }catch{/* La distance PostGIS reste disponible si OSRM est temporairement indisponible. */}
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
