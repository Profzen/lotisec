export interface RouteData {
  coordinates: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
}

export const getRoute = async (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): Promise<RouteData | null> => {
  try {
    // L'API OSRM prend les coordonnées au format: longitude,latitude
    const url = `http://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Erreur réseau OSRM");
    }
    
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error("Aucune route trouvée");
    }

    const route = data.routes[0];
    
    // GeoJSON retourne un tableau [longitude, latitude]
    const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
      latitude: coord[1],
      longitude: coord[0],
    }));

    // La distance est en mètres, on convertit en km
    const distanceKm = route.distance / 1000;
    // La durée est en secondes, on convertit en minutes
    const durationMin = route.duration / 60;

    return {
      coordinates,
      distanceKm,
      durationMin,
    };
  } catch (error) {
    console.error("Erreur getRoute:", error);
    return null;
  }
};
