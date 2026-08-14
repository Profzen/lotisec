import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Navigation, Car, AlertCircle, X, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { searchAddress, reverseGeocode, getShortName, NominatimResult } from '../utils/nominatim';
import { getRoute, RouteData } from '../utils/osrm';
import { api } from '../api/client';
import { supabase } from '../api/supabase';

const TILE_SOURCES = [
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

function ReliableTiles() {
  const [source, setSource] = useState(0);
  const failures = useRef(0);
  return <TileLayer key={source} url={TILE_SOURCES[source]} subdomains={source === 0 ? 'abcd' : 'abc'} maxZoom={19}
    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
    eventHandlers={{tileerror: () => { failures.current += 1; if (failures.current >= 3 && source < TILE_SOURCES.length - 1) setSource(source + 1); }}} />;
}

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Composant pour recentrer la carte ou écouter les clics
function MapController({ 
  destination, 
  onMapClick 
}: { 
  destination: { lat: number, lng: number } | null, 
  onMapClick: (lat: number, lng: number) => void 
}) {
  const map = useMap();
  
  useEffect(() => {
    if (destination) {
      map.flyTo([destination.lat, destination.lng], 15);
    }
  }, [destination, map]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

export function MapZem() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  // Fallback Lomé
  const DEFAULT_LOCATION = { lat: 6.1319, lng: 1.2228 };

  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [origin, setOrigin] = useState<{lat: number, lng: number} | null>(null);
  const [originName, setOriginName] = useState<string>('Ma position (GPS)');
  const [destination, setDestination] = useState<{lat: number, lng: number} | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  
  const [activeRide, setActiveRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gpsError, setGpsError] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'origin' | 'destination'>('destination');
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let watchId: number | undefined;

    if (!navigator.geolocation) {
      // Navigateur ne supporte pas la géolocalisation
      setLocation(DEFAULT_LOCATION);
      setGpsError(true);
      setLoading(false);
      return;
    }

    // Obtenir la première position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        if (!origin) {
          setOrigin(loc);
          setOriginName('Ma position (GPS)');
        }
        setGpsError(false);
        setLoading(false);

        // Lancer le suivi continu seulement après un premier succès
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            setLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
          },
          () => { /* silencieux — on a déjà une position */ },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      },
      (_err) => {
        // GPS refusé — utiliser Lomé par défaut
        console.warn("GPS refusé, fallback sur Lomé");
        setLocation(DEFAULT_LOCATION);
        if (!origin) {
          setOrigin(DEFAULT_LOCATION);
          setOriginName('Lomé (Défaut)');
        }
        setGpsError(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {

    if (supabase && user) {
      const channel = supabase
        .channel('public:rides')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, payload => {
          if (activeRide && payload.new.id === activeRide.id) {
            setActiveRide(payload.new);
            if (payload.new.status === 'accepted') toast.success("Votre Zem est en route !");
            else if (payload.new.status === 'completed') {
              toast.success("Course terminée.");
              setActiveRide(null);
              setDestination(null);
              setRouteData(null);
            }
          }
        })
        .subscribe();
        
      return () => { supabase?.removeChannel(channel); };
    }
  }, [activeRide, user]);

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
    }, 500);
  };

  const handleSelectResult = async (res: NominatimResult) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    const name = getShortName(res);
    if (searchTarget === 'origin') {
      setOrigin({ lat, lng });
      setOriginName(name);
    } else {
      setDestination({ lat, lng });
      setDestinationName(name);
    }
    setSearchQuery('');
    setShowResults(false);
    const routeOrigin = searchTarget === 'origin' ? { lat, lng } : origin;
    const routeDestination = searchTarget === 'destination' ? { lat, lng } : destination;
    if (routeOrigin && routeDestination) {
      const route = await getRoute({ latitude: routeOrigin.lat, longitude: routeOrigin.lng }, { latitude: routeDestination.lat, longitude: routeDestination.lng });
      setRouteData(route);
      if (!route) toast.error("Itinéraire indisponible. Réessayez ou choisissez un autre point.");
    }
    setSearchTarget('destination');
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (activeRide) return;
    setDestination({ lat, lng });
    setShowResults(false);
    
    const reverse = await reverseGeocode(lat, lng);
    if (reverse) {
      const name = getShortName(reverse);
      setDestinationName(name);
      setSearchQuery(name);
    } else {
      setDestinationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }

    if (origin) {
      const route = await getRoute({ latitude: origin.lat, longitude: origin.lng }, { latitude: lat, longitude: lng });
      setRouteData(route);
    }
  };

  const requestRide = async () => {
    if (!destination || !origin || !user || !routeData) return;
    const price = Math.round(routeData.distanceKm * 75);

    try {
      setLoading(true);
      const res = await api.post('/zem/request', {
        passengerId: user.id,
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: routeData.distanceKm,
        priceFcfa: price
      });
      if (res.data.ride) {
        setActiveRide(res.data.ride);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors de la commande.");
    } finally {
      setLoading(false);
    }
  };
  const cancelRide=async()=>{if(!activeRide)return;try{await api.post(`/zem/rides/${activeRide.id}/action`,{action:'cancel'});setActiveRide(null);setDestination(null);setRouteData(null);}catch{toast.error("Impossible d'annuler cette course.");}};

  if (!location) {
    return (
      <div className="app-content" style={{ position: 'relative', height: '100vh' }}>
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p className="mt-4" style={{color: 'var(--color-primary)', fontWeight: 'bold'}}>Acquisition GPS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      {/* Bouton retour */}
      <button className="map-back-button"
        onClick={() => window.history.back()} 
      >
        <ChevronLeft size={24} color="var(--color-primary)" />
      </button>

      {/* Overlay de chargement transparent si on lance une commande */}
      {loading && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--color-primary)' }}></div>
        </div>
      )}
      {/* GPS Warning */}
      {gpsError && (
        <div style={{ 
          position: 'absolute', top: 60, left: 10, right: 10, zIndex: 1100,
          backgroundColor: '#FFF3E0', border: '1px solid #FF9800', borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#E65100'
        }}>
          <AlertCircle size={18} />
          <span>GPS non autorisé. Position par défaut (Lomé). Vous pouvez quand même choisir une destination sur la carte.</span>
        </div>
      )}

      {/* Search Overlay */}
      {!activeRide && (
        <div className="map-search-overlay" style={{ top: '60px' }}>
          <button type="button" className={`route-point ${searchTarget === 'origin' ? 'active' : ''}`} onClick={() => { setSearchTarget('origin'); setSearchQuery(''); setSearchResults([]); setShowResults(false); }}>
            <MapPin size={20} color="var(--color-success)" />
            <span><small>Départ</small>{originName}</span>
          </button>

          {searchTarget === 'origin' && location && <button type="button" className="use-gps-button" onClick={async () => {
            setOrigin(location); setOriginName('Ma position (GPS)'); setSearchTarget('destination'); setSearchQuery(''); setShowResults(false);
            if (destination) { const route = await getRoute({latitude:location.lat,longitude:location.lng},{latitude:destination.lat,longitude:destination.lng}); setRouteData(route); }
          }}><Navigation size={15}/> Utiliser ma position GPS</button>}

          <div className="search-input-wrapper">
            <Search size={20} color="var(--color-danger)" />
            <input 
              type="text" 
              placeholder={searchTarget === 'origin' ? "Rechercher le point de départ..." : "Rechercher une destination..."}
              value={searchQuery}
              onChange={handleSearch}
              onFocus={() => setShowResults(true)}
              className="w-full"
            />
            {searchQuery && (
              <X size={20} className="text-secondary" style={{cursor: 'pointer'}} onClick={() => {
                setSearchQuery('');
                setShowResults(false);
                if (searchTarget === 'destination') { setDestination(null); setDestinationName(''); setRouteData(null); }
              }}/>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(res => (
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
          {showResults && searchQuery.trim().length >= 3 && !searching && searchResults.length === 0 && <div className="search-empty">Aucun lieu trouvé au Togo. Précisez le quartier ou la ville.</div>}
          {searching && <div className="search-empty">Recherche de l'adresse…</div>}
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer 
        center={origin ? [origin.lat, origin.lng] : [location.lat, location.lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <ReliableTiles />
        <MapController destination={destination} onMapClick={handleMapClick} />
        
        {/* Origin Location */}
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={L.divIcon({ className: 'custom-zem-icon', html: '<div style="background:var(--color-success);width:20px;height:20px;border-radius:10px;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>' })} />
        )}
        
        {/* Destination Marker */}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} />
        )}

        {/* Route Line */}
        {routeData && (
          <Polyline 
            positions={routeData.coordinates.map(c => [c.latitude, c.longitude])} 
            color="var(--color-primary)" 
            weight={5} 
          />
        )}
      </MapContainer>

      {/* Bottom Sheet UI */}
      <div className="bottom-sheet">
        {!activeRide ? (
          <>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={20} className="text-primary" />
              {destinationName ? destinationName : 'Choisissez une destination'}
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
                  <span className="estimate-label">Prix Estimé</span>
                  <span className="estimate-value estimate-price">{Math.round(routeData.distanceKm * 75)} FCFA</span>
                </div>
              </div>
            ) : (
              <p className="text-secondary mb-4" style={{ fontSize: '0.875rem' }}>
                Recherchez une adresse ou cliquez sur la carte pour voir l'itinéraire et le prix.
              </p>
            )}

            <button 
              className="btn primary" 
              style={{ width: '100%', padding: '15px' }}
              onClick={requestRide}
              disabled={!destination || !routeData || loading}
            >
              <Car size={20} />
              {loading ? 'Commande en cours...' : 'Commander un Lotisec Zem'}
            </button>
          </>
        ) : (
          <div className="text-center">
            <h3 className="text-primary mb-4">Course en cours</h3>
            <p className="text-secondary mb-4">
              {['searching','offered'].includes(activeRide.status) ? "Recherche d'un conducteur à proximité..." : "Le conducteur est affecté."}
            </p>
            <div className="estimate-box justify-center mb-4">
              <span className="estimate-value estimate-price">{activeRide.price_fcfa} FCFA</span>
            </div>
            <button className="btn danger" onClick={cancelRide}>
              Annuler la commande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
