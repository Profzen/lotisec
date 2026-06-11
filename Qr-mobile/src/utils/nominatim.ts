/**
 * Nominatim (OpenStreetMap) — Recherche d'adresse & géocodage inversé.
 * API gratuite, limite : 1 requête/seconde. Pas de clé API requise.
 * https://nominatim.org/release-docs/develop/api/
 */

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LotisecApp/1.0';

// Rate-limiting : au moins 1 seconde entre chaque requête
let lastRequestTime = 0;

const throttle = async (): Promise<void> => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
};

/**
 * Recherche d'adresses par texte libre.
 * Retourne les 5 résultats les plus pertinents,
 * limités au pays spécifié (défaut : Togo).
 */
export const searchAddress = async (
  query: string,
  countryCode: string = 'tg',
  limit: number = 5
): Promise<NominatimResult[]> => {
  if (!query || query.trim().length < 2) return [];

  await throttle();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: countryCode,
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'fr',
      },
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('[Nominatim] searchAddress error:', err);
    return [];
  }
};

/**
 * Géocodage inversé : coordonnées GPS → nom du lieu.
 * Retourne le nom affiché et l'adresse structurée.
 */
export const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<NominatimResult | null> => {
  await throttle();

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'fr',
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[Nominatim] reverseGeocode error:', err);
    return null;
  }
};

/**
 * Extrait un nom court et lisible d'un résultat Nominatim.
 * Ex: "Marché de Bè, Lomé" au lieu de l'adresse complète.
 */
export const getShortName = (result: NominatimResult): string => {
  const parts = result.display_name.split(',');
  // Prendre les 2 premiers éléments significatifs
  const meaningful = parts.slice(0, 2).map(p => p.trim());
  return meaningful.join(', ');
};
