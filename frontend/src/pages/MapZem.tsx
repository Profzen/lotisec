import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Navigation, Car, AlertCircle, X, ChevronLeft, CheckCircle, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { searchAddress, reverseGeocode, getShortName, NominatimResult } from '../utils/nominatim';
import { getRoute, RouteData } from '../utils/osrm';
import { api } from '../api/client';
import { supabase } from '../api/supabase';

// Note: rastertiles/voyager CARTO retiré car exige une clé API; utilisation directe de tile.openstreetmap.org
const TILE_SOURCES = [
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

function ReliableTiles() {
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      subdomains="abc"
      maxZoom={19}
      attribution="&copy; OpenStreetMap contributors"
    />
  );
}

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapController({
  destination,
  origin,
  onMapClick,
}: {
  destination: { lat: number; lng: number } | null;
  origin: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (destination && origin) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (destination) {
      map.flyTo([destination.lat, destination.lng], 15);
    }
  }, [destination, origin, map]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

const DEFAULT_LOME = { lat: 6.1319, lng: 1.2228 };

function MapFloatingControls({
  origin,
  location,
}: {
  origin: { lat: number; lng: number } | null;
  location: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = origin || location || DEFAULT_LOME;
    map.flyTo([target.lat, target.lng], 15);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.zoomIn();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.zoomOut();
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 240,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={handleRecenter}
        title="Recentrer sur ma position"
        aria-label="Recentrer"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#1565D8',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <Navigation size={20} />
      </button>

      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom avant"
        aria-label="Zoom avant"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#1E293B',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <Plus size={22} />
      </button>

      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom arrière"
        aria-label="Zoom arrière"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#1E293B',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <Minus size={22} />
      </button>
    </div>
  );
}

export function MapZem() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originName, setOriginName] = useState<string>('');
  const [originSource, setOriginSource] = useState<'gps' | 'manual' | null>(null);

  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsError, setGpsError] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination'>('destination');
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Geolocation acquisition
  useEffect(() => {
    let watchId: number | undefined;

    if (!navigator.geolocation) {
      setLocation(DEFAULT_LOME);
      setGpsError(true);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setOrigin(loc);
        setOriginName('Ma position (GPS)');
        setOriginSource('gps');
        setGpsError(false);
        setLoading(false);

        watchId = navigator.geolocation.watchPosition(
          (p) => {
            const cur = { lat: p.coords.latitude, lng: p.coords.longitude };
            setLocation(cur);
            // Only update origin automatically if originSource is gps and no active ride
            setOrigin((prev) => (originSource === 'gps' && !activeRide ? cur : prev));
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      },
      (_err) => {
        console.warn('GPS indisponible ou refuse. Vue centree sur Lome sans forcer l’origine.');
        setLocation(DEFAULT_LOME);
        setOrigin(null);
        setOriginName('');
        setOriginSource(null);
        setGpsError(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Supabase Realtime subscription for activeRide
  useEffect(() => {
    if (!activeRide?.id || !supabase) return;

    const channel = supabase
      .channel(`web-ride-${activeRide.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` },
        (payload: any) => {
          if (payload.new) {
            setActiveRide(payload.new);
            if (payload.new.status === 'accepted') toast.success('Un conducteur a accepte votre course !');
            else if (payload.new.status === 'driver_arrived') toast('Le Zem est arrive au point de depart !');
            else if (payload.new.status === 'completed') {
              toast.success('Course terminee avec succes.');
              setActiveRide(null);
              setDestination(null);
              setRouteData(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [activeRide?.id]);

  // Supabase Realtime subscription for Zem location
  useEffect(() => {
    if (!activeRide?.zem_id || !supabase) return;

    const channel = supabase
      .channel(`web-zem-loc-${activeRide.zem_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zem_locations', filter: `zem_id=eq.${activeRide.zem_id}` },
        (payload: any) => {
          if (payload.new?.latitude && payload.new?.longitude) {
            setZemLocation({ lat: payload.new.latitude, lng: payload.new.longitude });
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [activeRide?.zem_id]);

  // REST polling fallback every 4 seconds during active ride
  useEffect(() => {
    if (!activeRide?.id) return;
    const terminal = ['completed', 'canceled', 'expired', 'no_show', 'disputed'];
    if (terminal.includes(activeRide.status)) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/zem/rides/${activeRide.id}`);
        if (data?.ride) {
          setActiveRide((prev: any) => (!prev || prev.status !== data.ride.status ? data.ride : prev));
        }
      } catch {
        // Polling retry
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status]);

  const recalculateRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    try {
      const res = await getRoute({ latitude: from.lat, longitude: from.lng }, { latitude: to.lat, longitude: to.lng });
      if (res && res.coordinates?.length > 0) {
        setRouteData(res);
        setRouteError(null);
      } else {
        setRouteData(null);
        setRouteError('Itineraire routier temporairement indisponible.');
      }
    } catch {
      setRouteData(null);
      setRouteError('Erreur de calcul de l’itineraire.');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchQuery(text);
    setShowResults(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchAddress(text);
      setSearchResults(res);
      setSearching(false);
    }, 400);
  };

  const handleSelectResult = async (res: NominatimResult) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    const name = getShortName(res);

    if (searchTarget === 'origin') {
      setOrigin({ lat, lng });
      setOriginName(name);
      setOriginSource('manual');
      if (destination) recalculateRoute({ lat, lng }, destination);
      setSearchTarget('destination');
    } else {
      setDestination({ lat, lng });
      setDestinationName(name);
      if (origin) recalculateRoute(origin, { lat, lng });
    }

    setSearchQuery('');
    setShowResults(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (activeRide) return;
    setShowResults(false);

    const reverse = await reverseGeocode(lat, lng);
    const name = reverse ? getShortName(reverse) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (searchTarget === 'origin' || !origin) {
      setOrigin({ lat, lng });
      setOriginName(name);
      setOriginSource('manual');
      setSearchTarget('destination');
      if (destination) recalculateRoute({ lat, lng }, destination);
    } else {
      setDestination({ lat, lng });
      setDestinationName(name);
      recalculateRoute(origin, { lat, lng });
    }
  };

  const requestRide = async () => {
    if (!destination || !origin || !user || !routeData) {
      if (!origin) toast.error('Veuillez definir votre point de depart.');
      else if (!destination) toast.error('Veuillez definir une destination.');
      return;
    }

    const price = Math.max(300, Math.round(routeData.distanceKm * 75));

    try {
      setLoading(true);
      const res = await api.post('/zem/request', {
        passengerId: user.id,
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: routeData.distanceKm,
        priceFcfa: price,
      });
      if (res.data.ride) {
        setActiveRide(res.data.ride);
        toast.success('Recherche d’un conducteur en cours...');
      }
    } catch (err: any) {
      const detail = err.response?.data?.error || err.response?.data?.detail || 'Erreur lors de la commande.';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const executeRideAction = async (action: string) => {
    if (!activeRide) return;
    try {
      const res = await api.post(`/zem/rides/${activeRide.id}/action`, { action });
      if (res.data.ride) {
        setActiveRide(res.data.ride);
        if (action === 'cancel') {
          toast('Course annulee.');
          setActiveRide(null);
          setDestination(null);
          setRouteData(null);
        } else if (action === 'passenger_ready') {
          toast.success('Le conducteur a ete notifie que vous etes pret.');
        } else if (action === 'confirm_complete') {
          toast.success('Course confirmee et terminee.');
          setActiveRide(null);
          setDestination(null);
          setRouteData(null);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Action non autorisee.');
    }
  };

  if (!location) {
    return (
      <div className="app-content" style={{ position: 'relative', height: '100vh' }}>
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p className="mt-4" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
            Acquisition de la position...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      {/* Bouton retour */}
      <button className="map-back-button" onClick={() => window.history.back()} aria-label="Retour">
        <ChevronLeft size={24} color="var(--color-primary)" />
      </button>

      {/* Overlay chargement */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }}></div>
        </div>
      )}

      {/* GPS Warning */}
      {gpsError && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 10,
            right: 10,
            zIndex: 1100,
            backgroundColor: '#FFF3E0',
            border: '1px solid #FF9800',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.8rem',
            color: '#E65100',
          }}
        >
          <AlertCircle size={18} />
          <span>GPS desactive ou non autorise. Veuillez designer votre point de depart sur la carte ou via la recherche.</span>
        </div>
      )}

      {/* Search Overlay */}
      {!activeRide && (
        <div className="map-search-overlay" style={gpsError ? { top: '80px' } : undefined}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <button
              type="button"
              className={`route-point ${searchTarget === 'origin' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => {
                setSearchTarget('origin');
                setSearchQuery('');
                setShowResults(false);
              }}
            >
              <MapPin size={18} color="var(--color-success)" />
              <span>
                <small>Depart: </small>
                {originName || 'Cliquez ou cherchez'}
              </span>
            </button>

            <button
              type="button"
              className={`route-point ${searchTarget === 'destination' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => {
                setSearchTarget('destination');
                setSearchQuery('');
                setShowResults(false);
              }}
            >
              <MapPin size={18} color="var(--color-danger)" />
              <span>
                <small>Destination: </small>
                {destinationName || 'Cliquez ou cherchez'}
              </span>
            </button>
          </div>

          {searchTarget === 'origin' && location && !gpsError && (
            <button
              type="button"
              className="use-gps-button"
              style={{ marginBottom: 8 }}
              onClick={() => {
                setOrigin(location);
                setOriginName('Ma position (GPS)');
                setOriginSource('gps');
                setSearchTarget('destination');
                setShowResults(false);
                if (destination) recalculateRoute(location, destination);
              }}
            >
              <Navigation size={15} /> Utiliser ma position GPS actuelle
            </button>
          )}

          <div className="search-input-wrapper">
            <Search size={20} color={searchTarget === 'origin' ? 'var(--color-success)' : 'var(--color-danger)'} />
            <input
              type="text"
              placeholder={searchTarget === 'origin' ? 'Rechercher le lieu de prise en charge...' : 'Rechercher votre destination...'}
              value={searchQuery}
              onChange={handleSearch}
              onFocus={() => setShowResults(true)}
              className="w-full"
            />
            {searchQuery && (
              <X
                size={20}
                className="text-secondary"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                  if (searchTarget === 'destination') {
                    setDestination(null);
                    setDestinationName('');
                    setRouteData(null);
                  }
                }}
              />
            )}
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((res) => (
                <div key={res.place_id} className="search-result-item" onClick={() => handleSelectResult(res)}>
                  <MapPin size={18} className="text-primary" />
                  <div>
                    <div className="search-result-name">{getShortName(res)}</div>
                    <div className="search-result-address">{res.display_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showResults && searchQuery.trim().length >= 3 && !searching && searchResults.length === 0 && (
            <div className="search-empty">Aucun lieu trouve. Essayez un quartier ou repere a Lome.</div>
          )}
          {searching && <div className="search-empty">Recherche en cours...</div>}
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={origin ? [origin.lat, origin.lng] : [location.lat, location.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <ReliableTiles />
        <MapController destination={destination} origin={origin} onMapClick={handleMapClick} />
        <MapFloatingControls origin={origin} location={location} />

        {/* Origin Marker */}
        {origin && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={L.divIcon({
              className: 'custom-zem-icon',
              html: '<div style="background:var(--color-success);width:22px;height:22px;border-radius:11px;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.4)"></div>',
            })}
          />
        )}

        {/* Destination Marker */}
        {destination && <Marker position={[destination.lat, destination.lng]} />}

        {/* Live Zem Marker */}
        {zemLocation && (
          <Marker
            position={[zemLocation.lat, zemLocation.lng]}
            icon={L.divIcon({
              className: 'custom-zem-icon',
              html: '<div style="background:#1565D8;width:24px;height:24px;border-radius:12px;border:3px solid white;box-shadow:0 0 12px rgba(21,101,216,0.6)"></div>',
            })}
          />
        )}

        {/* Route Polyline */}
        {routeData && (
          <Polyline
            positions={routeData.coordinates.map((c) => [c.latitude, c.longitude])}
            color="var(--color-primary)"
            weight={5}
          />
        )}
      </MapContainer>

      {/* Bottom Sheet */}
      <div className="bottom-sheet">
        {!activeRide ? (
          <>
            <h3 style={{ marginBottom: '0.45rem', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Navigation size={18} className="text-primary" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {destinationName ? destinationName : 'Selectionnez votre destination'}
              </span>
            </h3>

            {routeData ? (
              <div className="estimate-box">
                <div className="estimate-item">
                  <span className="estimate-label">Distance</span>
                  <span className="estimate-value">{routeData.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="divider-vertical" />
                <div className="estimate-item">
                  <span className="estimate-label">Temps</span>
                  <span className="estimate-value">{routeData.durationMin.toFixed(0)} min</span>
                </div>
                <div className="divider-vertical" />
                <div className="estimate-item">
                  <span className="estimate-label">Prix Estime</span>
                  <span className="estimate-value estimate-price">{Math.max(300, Math.round(routeData.distanceKm * 75))} FCFA</span>
                </div>
              </div>
            ) : routeError ? (
              <p className="text-secondary" style={{ fontSize: '0.8rem', margin: '0.2rem 0 0.5rem', color: 'var(--color-warning)' }}>
                {routeError}
              </p>
            ) : (
              <p className="text-secondary" style={{ fontSize: '0.8rem', margin: '0.2rem 0 0.5rem' }}>
                {!origin
                  ? 'Veuillez designer votre lieu de depart sur la carte.'
                  : 'Cliquez sur la carte ou cherchez pour calculer l’itineraire.'}
              </p>
            )}

            <button
              className="btn primary"
              style={{ width: '100%', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.95rem' }}
              onClick={requestRide}
              disabled={!origin || !destination || !routeData || loading}
            >
              <Car size={18} />
              {loading
                ? 'Commande en cours...'
                : !origin
                ? 'Definir le depart d’abord'
                : !destination
                ? 'Definir la destination'
                : `Commander un Lotisec Zem (${routeData ? Math.max(300, Math.round(routeData.distanceKm * 75)) : 300} FCFA)`}
            </button>
          </>
        ) : (
          <div className="text-center">
            <h3 className="text-primary mb-2">Course en cours</h3>
            <p className="text-secondary mb-3" style={{ fontWeight: '600' }}>
              {activeRide.status === 'searching' && 'Recherche d’un conducteur a proximite...'}
              {activeRide.status === 'offered' && 'Proposition transmise a un conducteur...'}
              {activeRide.status === 'accepted' && 'Conducteur affecte ! En route vers vous.'}
              {activeRide.status === 'driver_en_route' && 'Le conducteur est en route.'}
              {activeRide.status === 'driver_arrived' && 'Le conducteur est arrive au point de depart.'}
              {activeRide.status === 'ready_to_start' && 'Pret pour le depart.'}
              {activeRide.status === 'in_progress' && 'Trajet vers la destination en cours.'}
              {activeRide.status === 'driver_completed' && 'Le conducteur a indique la fin du trajet.'}
              {activeRide.status === 'completed' && 'Course terminee.'}
            </p>

            <div className="estimate-box justify-center mb-3">
              <span className="estimate-value estimate-price">{activeRide.price_fcfa} FCFA</span>
              <span style={{ margin: '0 8px', color: 'var(--color-text-secondary)' }}>•</span>
              <span className="estimate-value">{activeRide.distance_km} km</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeRide.status === 'driver_arrived' && (
                <button className="btn primary" onClick={() => executeRideAction('passenger_ready')}>
                  <CheckCircle size={18} /> Je suis pret / Je monte
                </button>
              )}

              {activeRide.status === 'driver_completed' && (
                <button className="btn primary" onClick={() => executeRideAction('confirm_complete')}>
                  <CheckCircle size={18} /> Confirmer l’arrivee et terminer
                </button>
              )}

              <button
                className="btn ghost"
                style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                onClick={() => navigate(`/trajets/${activeRide.id}`)}
              >
                Ouvrir la fiche detaillee & discussion
              </button>

              {['searching', 'offered', 'accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress'].includes(
                activeRide.status
              ) && (
                <button className="btn danger" onClick={() => executeRideAction('cancel')}>
                  Annuler la course
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
