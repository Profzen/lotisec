export interface RouteData {
  coordinates: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
}

// Formule de Haversine avec facteur de correction routière (1.3) pour fallback fiable
export const calculateFallbackDistance = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): { distanceKm: number; durationMin: number } => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const dLon = ((end.longitude - start.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.latitude * Math.PI) / 180) *
      Math.cos((end.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawKm = R * c;
  // Facteur urbain 1.3 (les routes ne sont pas en ligne droite)
  const distanceKm = Math.max(0.5, Math.round(rawKm * 1.3 * 10) / 10);
  // Vitesse moyenne moto urbaine : ~30 km/h
  const durationMin = Math.max(1, Math.round((distanceKm / 30) * 60));

  return { distanceKm, durationMin };
};

export const getRoute = async (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): Promise<RouteData> => {
  const fallback = calculateFallbackDistance(start, end);
  const directLine = [
    { latitude: start.latitude, longitude: start.longitude },
    { latitude: end.latitude, longitude: end.longitude },
  ];

  try {
    // API OSRM HTTPS publique
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Erreur réseau OSRM');
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Aucune route trouvée');
    }

    const route = data.routes[0];

    const coordinates = route.geometry.coordinates.map(
      (coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0],
      })
    );

    const distanceKm = Math.max(0.5, Math.round((route.distance / 1000) * 10) / 10);
    const durationMin = Math.max(1, Math.round(route.duration / 60));

    return {
      coordinates: coordinates.length >= 2 ? coordinates : directLine,
      distanceKm,
      durationMin,
    };
  } catch (error) {
    console.warn('[OSRM] Utilisation du tracé de repli:', error);
    return {
      coordinates: directLine,
      distanceKm: fallback.distanceKm,
      durationMin: fallback.durationMin,
    };
  }
};
