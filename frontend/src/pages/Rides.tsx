import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { supabase } from '../api/supabase';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Car, ChevronRight, Navigation, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function Rides() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActiveRide = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get(`/zem/active/${user.id}`);
      if (res.data.ride) {
        setActiveRide(res.data.ride);
        fetchZemLocation(res.data.ride.zem_id);
      } else {
        setActiveRide(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchZemLocation = async (zemId: string) => {
    const { data } = await supabase!.from('zem_locations').select('*').eq('zem_id', zemId).single();
    if (data) {
      setZemLocation({ lat: data.latitude, lng: data.longitude });
    }
  };

  useEffect(() => {
    loadActiveRide();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !activeRide) return;

    // Ride updates (status change)
    const rideChannel = supabase
      .channel('ride_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` }, payload => {
        setActiveRide(payload.new);
        if (payload.new.status === 'completed') {
          toast.success("Votre course est terminée !");
          setActiveRide(null);
          setZemLocation(null);
        }
      })
      .subscribe();

    // Zem Location tracking
    const locChannel = supabase
      .channel('zem_tracking')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'zem_locations', filter: `zem_id=eq.${activeRide.zem_id}` }, payload => {
        setZemLocation({ lat: payload.new.latitude, lng: payload.new.longitude });
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(rideChannel);
      supabase?.removeChannel(locChannel);
    };
  }, [activeRide]);

  if (loading) {
    return <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>;
  }

  return (
    <>
      <div className="top-header" style={{ paddingBottom: '2rem' }}>
        <div style={{ color: 'white', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Mes Trajets</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Suivez votre course en cours</div>
        </div>
      </div>

      <div className="white-sheet" style={{ paddingTop: '2rem' }}>
        <button className="btn ghost mb-4" onClick={loadActiveRide}>
          <RefreshCw size={20} /> Rafraîchir
        </button>

        {activeRide ? (
          <div className="lotisec-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header info */}
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Course {activeRide.status === 'requested' ? 'en attente' : 'en cours'}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{activeRide.price_fcfa} FCFA • {activeRide.distance_km} km</div>
            </div>

            {/* Live Map */}
            <div style={{ height: '300px', width: '100%' }}>
              <MapContainer center={[activeRide.origin_lat, activeRide.origin_lng]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer url="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" />
                
                {/* Point de départ */}
                <Marker position={[activeRide.origin_lat, activeRide.origin_lng]} />
                {/* Destination */}
                <Marker position={[activeRide.dest_lat, activeRide.dest_lng]} />
                
                {/* Position du Zem en live */}
                {zemLocation && (
                  <Marker 
                    position={[zemLocation.lat, zemLocation.lng]} 
                    icon={L.divIcon({ className: 'custom-zem-icon', html: '<div style="background:var(--color-warning);width:24px;height:24px;border-radius:12px;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>' })} 
                  />
                )}
              </MapContainer>
            </div>

            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              {activeRide.status === 'requested' && "Recherche d'un conducteur..."}
              {activeRide.status === 'accepted' && "Le conducteur est en route vers votre point de départ !"}
              {activeRide.status === 'in_progress' && "Vous êtes en route vers votre destination !"}
            </div>
          </div>
        ) : (
          <div className="lotisec-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, backgroundColor: 'rgba(0,106,78,0.1)', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Navigation size={40} color="var(--color-primary)" />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>Aucune course en cours</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Vous n'avez pas de trajet actif pour le moment.
            </p>
            <button className="btn primary" onClick={() => window.location.href = '/map'}>
              <Car size={20} /> Commander un Zem
            </button>
          </div>
        )}
      </div>
    </>
  );
}
