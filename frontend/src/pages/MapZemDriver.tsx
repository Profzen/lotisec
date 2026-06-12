import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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

function MapController({ center }: { center: { lat: number, lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
}

export function MapZemDriver() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);

  // Mettre à jour la localisation côté API
  const updateZemLocation = async (lat: number, lng: number, online: boolean) => {
    if (!user) return;
    try {
      await api.post('/zem/location', {
        zemId: user.id, lat, lng, isOnline: online
      });
    } catch (err) {
      console.error("Erreur API Location", err);
    }
  };

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      // Position initiale
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLoading(false);
        },
        (err) => {
          console.error("GPS Error", err);
          setLocation({ lat: 6.13, lng: 1.21 });
          setLoading(false);
        }
      );

      // Suivi continu
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          if (isOnline && user) {
            updateZemLocation(lat, lng, true);
          }
        },
        (err) => console.error("GPS Watch Error", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } else {
      setLoading(false);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Écoute des courses via Supabase
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel('public:rides:driver')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides', filter: `zem_id=eq.${user.id}` }, payload => {
        if (payload.new.status === 'requested') {
          handleNewRideRequest(payload.new);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `zem_id=eq.${user.id}` }, payload => {
        if (payload.new.status === 'canceled' && activeRide?.id === payload.new.id) {
          alert("La course a été annulée par le client.");
          setActiveRide(null);
          setRouteData(null);
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [user, activeRide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewRideRequest = (ride: any) => {
    if (window.confirm(`🚀 Nouvelle course !\nDistance: ${ride.distance_km} km\nGains: ${ride.price_fcfa} FCFA\nAccepter la course ?`)) {
      acceptRide(ride);
    } else {
      declineRide(ride.id);
    }
  };

  const acceptRide = async (ride: any) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase!
        .from('rides')
        .update({ status: 'accepted' })
        .eq('id', ride.id)
        .select()
        .single();
      
      if (error) throw error;
      setActiveRide(data);
      
      setIsOnline(false);
      if (location) updateZemLocation(location.lat, location.lng, false);

      const rData = await getRoute(
        { latitude: data.origin_lat, longitude: data.origin_lng },
        { latitude: data.dest_lat, longitude: data.dest_lng }
      );
      setRouteData(rData);

    } catch (err) {
      alert("Impossible d'accepter la course.");
    }
  };

  const declineRide = async (rideId: string) => {
    if (!supabase) return;
    try {
      await supabase!.from('rides').update({ status: 'declined' }).eq('id', rideId);
    } catch (err) {
      console.error(err);
    }
  };

  const completeRide = async () => {
    if (!activeRide || !supabase) return;
    try {
      await supabase!.from('rides').update({ status: 'completed' }).eq('id', activeRide.id);
      alert(`Course terminée. Vous avez gagné ${activeRide.price_fcfa} FCFA.`);
      setActiveRide(null);
      setRouteData(null);
      setIsOnline(true);
      if (location) updateZemLocation(location.lat, location.lng, true);
    } catch (err) {
      alert("Impossible de clôturer la course.");
    }
  };

  const toggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (location && user) {
      updateZemLocation(location.lat, location.lng, newStatus);
    }
  };

  if (!location || loading) return <div className="center-state">Chargement carte GPS...</div>;

  return (
    <div className="map-container">
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, backgroundColor: 'white', padding: '10px', borderRadius: '10px', fontWeight: 'bold' }}>
        MODE CONDUCTEUR
      </div>

      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={15} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapController center={location} />
        
        {/* Position du conducteur */}
        <Marker position={[location.lat, location.lng]} />

        {/* Tracé de la course */}
        {activeRide && (
          <>
            <Marker position={[activeRide.origin_lat, activeRide.origin_lng]} />
            <Marker position={[activeRide.dest_lat, activeRide.dest_lng]} />
            {routeData && (
              <Polyline 
                positions={routeData.coordinates.map(c => [c.latitude, c.longitude])} 
                color="var(--color-primary)" 
                weight={5} 
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Panneau inférieur */}
      <div className="bottom-sheet">
        {!activeRide ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-danger)' }} />
              <span style={{ fontWeight: 'bold' }}>{isOnline ? "En Ligne - Prêt" : "Hors Ligne"}</span>
            </div>
            
            {/* Warning that web geolocation is fragile */}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: '1rem' }}>
              ⚠️ Sur le web, gardez cette page ouverte pour que votre position soit envoyée aux passagers.
            </div>

            <button 
              className="btn" 
              style={{ backgroundColor: isOnline ? 'var(--color-danger)' : 'var(--color-success)', color: 'white' }}
              onClick={toggleOnline}
            >
              {isOnline ? "Se mettre hors ligne" : "Se mettre en ligne"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <h3 className="mb-4">Course en cours</h3>
            <p className="mb-4 text-success" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
              Gain estimé : {activeRide.price_fcfa} FCFA
            </p>
            <button className="btn primary" onClick={completeRide}>
              Terminer la course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
