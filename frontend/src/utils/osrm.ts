/**
 * OSRM (Open Source Routing Machine) — Itinéraires (Web).
 * Utilise l'API publique (router.project-osrm.org).
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteData {
  distanceKm: number;
  durationMin: number;
  coordinates: Coordinate[]; // Points pour dessiner la ligne (Polyline)
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export const getRoute = async (origin: Coordinate, destination: Coordinate): Promise<RouteData | null> => {
  try {
    // Format OSRM: lon,lat;lon,lat
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    
    // geometries=geojson renvoie directement un tableau de coordonnées [lon, lat] facilement exploitable
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Erreur serveur OSRM");
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    
    // distance est en mètres, on veut des kilomètres
    const distanceKm = route.distance / 1000;
    
    // duration est en secondes, on veut des minutes
    const durationMin = route.duration / 60;

    // geometry.coordinates contient des paires [longitude, latitude]
    const coordinates: Coordinate[] = route.geometry.coordinates.map((c: number[]) => ({
      latitude: c[1],
      longitude: c[0]
    }));

    return {
      distanceKm,
      durationMin,
      coordinates
    };

  } catch (error) {
    console.warn("[OSRM] Erreur lors du calcul d'itinéraire", error);
    return null;
  }
};
