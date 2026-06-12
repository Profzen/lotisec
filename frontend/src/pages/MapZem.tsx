import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Navigation, Car, AlertCircle, X } from 'lucide-react';
import { searchAddress, reverseGeocode, getShortName, NominatimResult } from '../utils/nominatim';
import { getRoute, RouteData } from '../utils/osrm';
import { api } from '../api/client';
import { supabase } from '../api/supabase';

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
            if (payload.new.status === 'accepted') alert("Votre Zem est en route !");
            else if (payload.new.status === 'completed') {
              alert("Course terminée.");
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
      const res = await searchAddress(text);
      setSearchResults(res);
    }, 500);
  };

  const handleSelectResult = async (res: NominatimResult) => {
    const lat = parseFloat(res.lat);
    const lng = parseFloat(res.lon);
    setDestination({ lat, lng });
    setDestinationName(getShortName(res));
    setSearchQuery(getShortName(res));
    setShowResults(false);
    
    if (location) {
      const route = await getRoute({ latitude: location.lat, longitude: location.lng }, { latitude: lat, longitude: lng });
      setRouteData(route);
    }
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

    if (location) {
      const route = await getRoute({ latitude: location.lat, longitude: location.lng }, { latitude: lat, longitude: lng });
      setRouteData(route);
    }
  };

  const requestRide = async () => {
    if (!destination || !location || !user || !routeData) return;
    const price = Math.round(routeData.distanceKm * 75);

    try {
      setLoading(true);
      const res = await api.post('/zem/request', {
        passengerId: user.id,
        originLat: location.lat,
        originLng: location.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        distanceKm: routeData.distanceKm,
        priceFcfa: price
      });
      if (res.data.ride) {
        setActiveRide(res.data.ride);
      }
    } catch (err) {
      alert("Erreur lors de la commande.");
    } finally {
      setLoading(false);
    }
  };

  if (!location || loading) return <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Chargement carte...</div>;

  return (
    <div className="map-container">
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
        <div className="map-search-overlay">
          <div className="search-input-wrapper">
            <Search size={20} className="text-secondary" />
            <input 
              type="text" 
              placeholder="Rechercher une destination..." 
              value={searchQuery}
              onChange={handleSearch}
              onFocus={() => setShowResults(true)}
              className="w-full"
            />
            {searchQuery && (
              <X size={20} className="text-secondary" style={{cursor: 'pointer'}} onClick={() => {
                setSearchQuery('');
                setShowResults(false);
                setDestination(null);
                setRouteData(null);
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
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapController destination={destination} onMapClick={handleMapClick} />
        
        {/* User Location */}
        <Marker position={[location.lat, location.lng]} />
        
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
              disabled={!destination || !routeData || loading}
              onClick={requestRide}
            >
              <Car size={20} />
              {loading ? 'Commande en cours...' : 'Commander un Lotisec Zem'}
            </button>
          </>
        ) : (
          <div className="text-center">
            <h3 className="text-primary mb-4">Course {activeRide.status === 'requested' ? 'en attente' : 'en cours'}</h3>
            <p className="text-secondary mb-4">
              {activeRide.status === 'requested' ? "Recherche d'un conducteur à proximité..." : "Le conducteur est en route !"}
            </p>
            <div className="estimate-box justify-center mb-4">
              <span className="estimate-value estimate-price">{activeRide.price_fcfa} FCFA</span>
            </div>
            <button className="btn danger" onClick={() => {
              /* Logic to cancel in Supabase */
              setActiveRide(null);
              setDestination(null);
              setRouteData(null);
            }}>
              Annuler la commande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
