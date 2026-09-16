import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ChevronLeft, Navigation, CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { supabase } from '../api/supabase';
import { getRoute, RouteData } from '../utils/osrm';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapController({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
}

export function MapZemDriver() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const isDriver = useMemo(() => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : [user.role];
    return roles.includes('zem_driver') || roles.includes('admin');
  }, [user]);

  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOffer, setCurrentOffer] = useState<any>(null);
  const [offerSecondsLeft, setOfferSecondsLeft] = useState<number>(45);

  // Broadcast position to backend
  const updateZemLocation = async (
    lat: number,
    lng: number,
    online: boolean,
    telemetry?: { accuracy?: number; heading?: number; speed?: number }
  ) => {
    if (!user) return;
    try {
      await api.post('/zem/location', {
        zemId: user.id,
        lat,
        lng,
        isOnline: online,
        accuracy: telemetry?.accuracy ?? null,
        heading: telemetry?.heading ?? null,
        speed: telemetry?.speed ?? null,
      });
    } catch (err) {
      console.error('Erreur transmission position Zem', err);
    }
  };

  // Continuous geolocation watch
  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
          };
          setLocation(loc);
          setGpsError(false);
          setLoading(false);
        },
        (err) => {
          console.error('Erreur GPS conducteur', err);
          setLocation(null);
          setGpsError(true);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
          };
          setLocation(loc);
          setGpsError(false);
          if (isOnline && user) {
            updateZemLocation(loc.lat, loc.lng, true, {
              accuracy: loc.accuracy,
              heading: loc.heading,
              speed: loc.speed,
            });
          }
        },
        (err) => {
          console.error('Erreur continu GPS', err);
          setGpsError(true);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
    } else {
      setGpsError(true);
      setLoading(false);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, user]);

  // Load current offer from REST API
  const loadOffer = async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/zem/offers/current');
      const offer = data.offers?.[0] || null;
      setCurrentOffer(offer);
      if (offer && offer.expires_at) {
        const remaining = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000));
        setOfferSecondsLeft(remaining > 0 ? remaining : 45);
      }
    } catch {
      // Re-try next loop
    }
  };

  // Poll offers every 5 seconds
  useEffect(() => {
    loadOffer();
    const timer = window.setInterval(loadOffer, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Countdown timer for incoming offer
  useEffect(() => {
    if (!currentOffer) return;
    const interval = setInterval(() => {
      setOfferSecondsLeft((prev) => {
        if (prev <= 1) {
          setCurrentOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentOffer]);

  // Supabase realtime for driver offers and rides
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel(`driver-offers-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ride_offers', filter: `zem_id=eq.${user.id}` },
        loadOffer
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `zem_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new) {
            if (payload.new.status === 'canceled' && activeRide?.id === payload.new.id) {
              toast.error('La course a ete annulee.');
              setActiveRide(null);
              setRouteData(null);
            } else if (activeRide?.id === payload.new.id) {
              setActiveRide(payload.new);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [user, activeRide]);

  // REST polling for active ride status every 4 seconds
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

  const acceptRide = async (offer: any) => {
    try {
      const { data: response } = await api.post(`/zem/offers/${offer.id}/respond`, { decision: 'accept' });
      const ride = response.ride;
      setActiveRide(ride);
      setCurrentOffer(null);

      setIsOnline(false);
      if (location) {
        updateZemLocation(location.lat, location.lng, false);
      }

      // Calculate route
      const rData = await getRoute(
        { latitude: ride.origin_lat, longitude: ride.origin_lng },
        { latitude: ride.dest_lat, longitude: ride.dest_lng }
      );
      setRouteData(rData);
      toast.success('Course acceptee ! Dirigez-vous vers le client.');
    } catch {
      toast.error('Impossible d’accepter cette course (peut-etre deja expiree).');
      setCurrentOffer(null);
    }
  };

  const declineRide = async (offerId: string) => {
    try {
      await api.post(`/zem/offers/${offerId}/respond`, { decision: 'decline' });
      setCurrentOffer(null);
      await loadOffer();
      toast('Proposition refusee.');
    } catch {
      setCurrentOffer(null);
    }
  };

  const advanceRide = async (action: string) => {
    if (!activeRide) return;
    try {
      const { data } = await api.post(`/zem/rides/${activeRide.id}/action`, { action });
      setActiveRide(data.ride);
      if (action === 'driver_completed') {
        toast.success('Trajet marque termine. En attente de confirmation client.');
      } else if (action === 'no_show') {
        toast('Absence passager signalee.');
        setActiveRide(null);
        setRouteData(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Cette action n’est pas autorisee.');
    }
  };

  const toggleOnline = () => {
    if (!isOnline && (!location || gpsError)) {
      toast.error('Position GPS introuvable. Activez le GPS de votre appareil pour vous mettre en ligne.');
      return;
    }

    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (location && user) {
      updateZemLocation(location.lat, location.lng, newStatus, {
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
      });
    }
    toast.success(newStatus ? 'Vous etes en ligne et disponible.' : 'Vous etes hors ligne.');
  };

  if (!isDriver) {
    return (
      <div className="app-content" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertTriangle size={48} color="var(--color-warning)" style={{ margin: '0 auto 1rem' }} />
        <h2>Acces reserve aux conducteurs</h2>
        <p className="text-secondary mt-2">
          Votre compte n’a pas le role <strong>zem_driver</strong>. Connectez-vous avec un compte conducteur ou contactez
          l’administration LOTISEC.
        </p>
        <button className="btn primary mt-4" onClick={() => navigate('/zem')}>
          Retour a l’accueil Zem
        </button>
      </div>
    );
  }

  if (loading && !location) {
    return (
      <div className="app-content" style={{ position: 'relative', height: '100vh' }}>
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p className="mt-4" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
            Acquisition du signal GPS conducteur...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      {/* Bouton retour */}
      <button
        onClick={() => window.history.back()}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 1100,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={24} color="var(--color-primary)" />
      </button>

      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 1000,
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          padding: '8px 14px',
          borderRadius: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        />
        <span>MODE CONDUCTEUR</span>
      </div>

      {gpsError && (
        <div
          style={{
            position: 'absolute',
            top: '4.5rem',
            left: '1rem',
            right: '1rem',
            zIndex: 1000,
            backgroundColor: '#FFEBEE',
            border: '1px solid #E53935',
            padding: '10px 14px',
            borderRadius: '10px',
            color: '#C62828',
            fontSize: '0.85rem',
          }}
        >
          Signal GPS non disponible. Veuillez autoriser la geolocalisation pour passer en ligne.
        </div>
      )}

      <MapContainer
        center={location ? [location.lat, location.lng] : [6.1319, 1.2228]}
        zoom={15}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        {location && <MapController center={location} />}

        {location && (
          <Marker
            position={[location.lat, location.lng]}
            icon={L.divIcon({
              className: 'custom-zem-icon',
              html: '<div style="background:#1565D8;width:22px;height:22px;border-radius:11px;border:3px solid white;box-shadow:0 0 10px rgba(21,101,216,0.6)"></div>',
            })}
          />
        )}

        {activeRide && (
          <>
            <Marker position={[activeRide.origin_lat, activeRide.origin_lng]} />
            <Marker position={[activeRide.dest_lat, activeRide.dest_lng]} />
            {routeData && (
              <Polyline
                positions={routeData.coordinates.map((c) => [c.latitude, c.longitude])}
                color="var(--color-primary)"
                weight={5}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Panneau inferieur */}
      <div className="bottom-sheet">
        {currentOffer ? (
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Nouvelle proposition</h3>
              <span style={{ color: 'var(--color-warning)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                Expire dans {offerSecondsLeft}s
              </span>
            </div>
            <p style={{ margin: '0 0 1rem 0' }}>
              <strong>{currentOffer.price_fcfa} FCFA</strong> • {currentOffer.distance_km} km
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--color-danger)', color: 'white' }}
                onClick={() => declineRide(currentOffer.id)}
              >
                <XCircle size={18} /> Refuser
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: 'var(--color-success)', color: 'white' }}
                onClick={() => acceptRide(currentOffer)}
              >
                <CheckCircle size={18} /> Accepter ({offerSecondsLeft}s)
              </button>
            </div>
          </div>
        ) : !activeRide ? (
          <>
            <div
              style={{
                textAlign: 'center',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              />
              <span style={{ fontWeight: 'bold' }}>{isOnline ? 'En Ligne - Pret pour les courses' : 'Hors Ligne'}</span>
            </div>

            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                marginBottom: '1rem',
              }}
            >
              Gardez cette page active pour transmettre votre position et recevoir les commandes des passagers.
            </div>

            <button
              className="btn"
              style={{
                width: '100%',
                backgroundColor: isOnline ? 'var(--color-danger)' : 'var(--color-success)',
                color: 'white',
                padding: '14px',
              }}
              onClick={toggleOnline}
            >
              {isOnline ? 'Se mettre hors ligne' : 'Se mettre en ligne'}
            </button>
          </>
        ) : (
          <div className="text-center">
            <h3 className="mb-2">Course en cours</h3>
            <p className="mb-3 text-success" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
              Gain : {activeRide.price_fcfa} FCFA • {activeRide.distance_km} km
            </p>

            <p style={{ fontWeight: '600', color: 'var(--color-primary)', marginBottom: '1rem' }}>
              {activeRide.status === 'accepted' && 'En attente de demarrage de l’approche'}
              {activeRide.status === 'driver_en_route' && 'En route vers le client'}
              {activeRide.status === 'driver_arrived' && 'Vous etes arrive. En attente du passager'}
              {activeRide.status === 'ready_to_start' && 'Le passager est pret. Vous pouvez demarrer'}
              {activeRide.status === 'in_progress' && 'Trajet en cours vers la destination'}
              {activeRide.status === 'driver_completed' && 'Arrivee indiquee. En attente de confirmation client'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeRide.status === 'accepted' && (
                <button className="btn primary" onClick={() => advanceRide('driver_en_route')}>
                  <Navigation size={18} /> Commencer l’approche
                </button>
              )}

              {activeRide.status === 'driver_en_route' && (
                <button className="btn primary" onClick={() => advanceRide('driver_arrived')}>
                  <CheckCircle size={18} /> Je suis arrive au point de depart
                </button>
              )}

              {activeRide.status === 'driver_arrived' && (
                <button
                  className="btn"
                  style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
                  onClick={() => advanceRide('no_show')}
                >
                  Signaler absence passager (No-show)
                </button>
              )}

              {activeRide.status === 'ready_to_start' && (
                <button className="btn primary" onClick={() => advanceRide('start')}>
                  <CheckCircle size={18} /> Demarrer le trajet
                </button>
              )}

              {activeRide.status === 'in_progress' && (
                <button className="btn primary" onClick={() => advanceRide('driver_completed')}>
                  <CheckCircle size={18} /> Arrive a destination
                </button>
              )}

              <button
                className="btn ghost"
                style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                onClick={() => navigate(`/trajets/${activeRide.id}`)}
              >
                <MessageSquare size={18} /> Discussion & Fiche de la course
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
