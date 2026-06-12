import { Router } from 'express';
import { query } from '../database';

const router = Router();

// Endpoint pour qu'un passager demande un Zem
router.post('/request', async (req, res) => {
  const { passengerId, originLat, originLng, destLat, destLng, distanceKm, priceFcfa, excludedZems = [] } = req.body;

  if (!passengerId || !originLat || !originLng) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // 1. Trouver le Zem en ligne le plus proche qui n'est pas dans excludedZems
    let queryStr = `
      SELECT zem_id,
             ROUND(ST_Distance(
               location::geography,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
             )::numeric / 1000, 2) AS dist_km
      FROM zem_locations
      WHERE is_online = true
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        5000 -- Rayon de 5 km (5000 mètres)
      )
    `;
    const params: any[] = [originLng, originLat];

    if (excludedZems.length > 0) {
      queryStr += ` AND zem_id != ALL($3::varchar[]) `;
      params.push(excludedZems);
    }

    queryStr += ` ORDER BY dist_km LIMIT 1 `;

    const zemResult = await query<any>(queryStr, params);

    if (zemResult.rows.length === 0) {
      return res.status(400).json({ error: "Aucun Zem n'est actuellement disponible dans un rayon de 5 km." });
    }

    const nearestZem = zemResult.rows[0];

    // 2. Créer la course
    const rideResult = await query<any>(`
      INSERT INTO rides (passenger_id, zem_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, price_fcfa, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'requested')
      RETURNING *;
    `, [passengerId, nearestZem.zem_id, originLat, originLng, destLat, destLng, distanceKm, priceFcfa]);

    return res.json({ ride: rideResult.rows[0], zem_distance: nearestZem.dist_km });

  } catch (error: any) {
    console.error("Erreur Zem request:", error);
    return res.status(500).json({ error: "Erreur interne serveur." });
  }
});

// Endpoint pour qu'un Zem mette à jour sa position
router.post('/location', async (req, res) => {
  const { zemId, lat, lng, isOnline } = req.body;

  if (!zemId || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const result = await query<any>(`
      INSERT INTO zem_locations (zem_id, latitude, longitude, is_online, location, updated_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())
      ON CONFLICT (zem_id) 
      DO UPDATE SET 
        latitude = EXCLUDED.latitude, 
        longitude = EXCLUDED.longitude,
        is_online = EXCLUDED.is_online,
        location = EXCLUDED.location,
        updated_at = NOW()
      RETURNING *;
    `, [zemId, lat, lng, isOnline]);

    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Endpoint pour récupérer la course en cours d'un passager
router.get('/active/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await query<any>(`
      SELECT * FROM rides
      WHERE passenger_id = $1
      AND status IN ('requested', 'accepted', 'in_progress')
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ ride: null });
    }

    return res.json({ ride: result.rows[0] });
  } catch (err: any) {
    console.error("Erreur GET /active:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
