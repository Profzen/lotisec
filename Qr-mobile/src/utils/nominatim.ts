/**
 * Nominatim (OpenStreetMap) — Recherche d'adresse & géocodage inversé restreint au Togo.
 * Limites strictes : République Togolaise uniquement.
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
    country_code?: string;
  };
}

export const TOGO_BOUNDS = {
  minLat: 5.95,
  maxLat: 11.25,
  minLng: -0.25,
  maxLng: 1.95,
};

export function isInsideTogo(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= TOGO_BOUNDS.minLat &&
    lat <= TOGO_BOUNDS.maxLat &&
    lng >= TOGO_BOUNDS.minLng &&
    lng <= TOGO_BOUNDS.maxLng
  );
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LotisecApp/1.0';

// Rate-limiting : au moins 1 seconde entre chaque requête
let lastRequestTime = 0;

const throttle = async (): Promise<void> => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
};

/**
 * Recherche d'adresses par texte libre, STRICTEMENT limitée au Togo.
 */
export const searchAddress = async (
  query: string,
  _countryCode: string = 'tg',
  limit: number = 5
): Promise<NominatimResult[]> => {
  if (!query || query.trim().length < 2) return [];

  await throttle();

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: 'tg',
      viewbox: '-0.25,11.25,1.95,5.95',
      bounded: '1',
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'fr',
      },
    });

    if (!res.ok) return [];
    const data: NominatimResult[] = await res.json();

    // Filtrer strictement les résultats appartenant au Togo
    return data.filter((item) => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const validCountry = !item.address?.country_code || item.address.country_code === 'tg';
      return validCountry && isInsideTogo(lat, lon);
    });
  } catch (err) {
    console.warn('[Nominatim] searchAddress error:', err);
    return [];
  }
};

/**
 * Géocodage inversé : coordonnées GPS → nom du lieu.
 * Refuse et retourne null si les coordonnées sont hors du Togo.
 */
export const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<NominatimResult | null> => {
  if (!isInsideTogo(lat, lon)) {
    console.warn('[Nominatim] reverseGeocode rejeté : coordonnées hors Togo', lat, lon);
    return null;
  }

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
    const data: NominatimResult = await res.json();

    if (data.address?.country_code && data.address.country_code !== 'tg') {
      console.warn('[Nominatim] résultat rejeté hors Togo:', data.address.country_code);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[Nominatim] reverseGeocode error:', err);
    return null;
  }
};

/**
 * Extrait un nom court et lisible d'un résultat Nominatim.
 */
export const getShortName = (result: NominatimResult): string => {
  if (!result || !result.display_name) return '';
  const parts = result.display_name.split(',');
  const meaningful = parts.slice(0, 2).map((p) => p.trim());
  return meaningful.join(', ');
};
