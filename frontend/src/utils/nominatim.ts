/**
 * Nominatim (OpenStreetMap) — Recherche d'adresse & géocodage inversé (Web).
 * API gratuite, limite : 1 requête/seconde. Pas de clé API requise.
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
const USER_AGENT = 'LotisecWebApp/1.0';

let lastRequestTime = 0;

const throttle = async (): Promise<void> => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
};

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

export const getShortName = (result: NominatimResult): string => {
  const parts = result.display_name.split(',');
  const meaningful = parts.slice(0, 2).map(p => p.trim());
  return meaningful.join(', ');
};
