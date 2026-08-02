import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { supabase } from '../api/supabase';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Car, Navigation, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {useNavigate} from 'react-router-dom';

export function Rides() {
  const navigate=useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [rides, setRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [zemLocation, setZemLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/zem/history?page=1&page_size=50');
      if (res.data.rides) {
        setRides(res.data.rides);
        const currentActive = res.data.rides.find((r: any) => ['searching','offered','accepted','driver_en_route','driver_arrived','ready_to_start','in_progress','driver_completed'].includes(r.status));
        setActiveRide(currentActive || null);
        if (currentActive) {
          fetchZemLocation(currentActive.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchZemLocation = async (rideId: string) => {
    try{const {data}=await api.get(`/zem/rides/${rideId}/positions/latest`);if(data.position)setZemLocation({lat:data.position.latitude,lng:data.position.longitude});}catch{/* Realtime ou prochain rafraîchissement. */}
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !activeRide) return;

    // Ride updates (status change)
    const rideChannel = supabase
      .channel('ride_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` }, payload => {
        setActiveRide(payload.new);
        setRides(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        if (['completed', 'canceled', 'expired','no_show','disputed'].includes(payload.new.status)) {
          if (payload.new.status === 'completed') toast.success("Votre course est terminée !");
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
          <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Historique et suivi en direct</div>
        </div>
      </div>

      <div className="white-sheet" style={{ paddingTop: '2rem' }}>
        <button className="btn ghost mb-4" onClick={loadHistory}>
          <RefreshCw size={20} /> Rafraîchir
        </button>

        {activeRide && (
          <div className="lotisec-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: '2rem', border: '2px solid var(--color-primary)' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Course en cours</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{activeRide.price_fcfa} FCFA • {activeRide.distance_km} km</div>
            </div>

            <div style={{ height: '250px', width: '100%' }}>
              <MapContainer center={[activeRide.origin_lat, activeRide.origin_lng]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer url="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" />
                <Marker position={[activeRide.origin_lat, activeRide.origin_lng]} />
                <Marker position={[activeRide.dest_lat, activeRide.dest_lng]} />
                {zemLocation && (
                  <Marker 
                    position={[zemLocation.lat, zemLocation.lng]} 
                    icon={L.divIcon({ className: 'custom-zem-icon', html: '<div style="background:var(--color-warning);width:24px;height:24px;border-radius:12px;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>' })} 
                  />
                )}
              </MapContainer>
            </div>

            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>
              {['searching','offered'].includes(activeRide.status) && "Recherche d'un conducteur..."}
              {['accepted','driver_en_route','driver_arrived','ready_to_start'].includes(activeRide.status) && "Le conducteur arrive vers vous."}
              {activeRide.status === 'in_progress' && "Trajet en cours vers la destination !"}
              <button className="btn primary mt-4" onClick={()=>navigate(`/trajets/${activeRide.id}`)}>Ouvrir le suivi et le chat</button>
            </div>
          </div>
        )}

        <div className="lotisec-card-header">Historique</div>
        {rides.length === 0 ? (
          <div className="lotisec-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
            <Navigation size={40} color="var(--color-text-light)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Aucune course</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Vous n'avez pas encore effectué de trajet.
            </p>
            <button className="btn primary" onClick={() => window.location.href = '/map'}>
              <Car size={20} /> Commander un Zem
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rides.filter(r => r.id !== activeRide?.id).map((ride, idx) => (
              <div key={idx} className="action-item" style={{ cursor: 'default' }}>
                <div className={`action-icon ${ride.status === 'completed' ? 'green' : ride.status === 'canceled' || ride.status === 'declined' ? 'red' : 'yellow'}`}>
                  {ride.status === 'completed' ? <CheckCircle size={24} /> : ride.status === 'canceled' || ride.status === 'declined' ? <XCircle size={24} /> : <Clock size={24} />}
                </div>
                <div className="action-content">
                  <div className="action-title">Trajet ZEM</div>
                  <div className="action-subtitle">{new Date(ride.created_at).toLocaleDateString()} • {ride.distance_km} km</div>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
                  {ride.price_fcfa} FCFA
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
