import { FormEvent, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, CheckCircle, MessageCircle, Send, AlertTriangle, XOctagon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { supabase } from '../api/supabase';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const labels: Record<string, string> = {
  searching: 'Recherche en cours',
  offered: 'Proposition envoyee',
  accepted: 'Zem affecte',
  driver_en_route: 'Le Zem arrive vers vous',
  driver_arrived: 'Zem arrive au point de depart',
  ready_to_start: 'Passager pret - En attente du depart',
  in_progress: 'Trajet en cours',
  driver_completed: 'Arrivee signalee - A confirmer',
  completed: 'Course terminee',
  canceled: 'Course annulee',
  expired: 'Aucun Zem disponible',
  no_show: 'Passager absent',
  disputed: 'En cours de verification',
};

export function RideDetail() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const user = useMemo(() => JSON.parse(localStorage.getItem('lotisec_user') || '{}'), []);

  const [ride, setRide] = useState<any>();
  const [position, setPosition] = useState<any>();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const load = async () => {
    if (!rideId) return;
    try {
      const [{ data: r }, { data: p }, { data: m }] = await Promise.all([
        api.get(`/zem/rides/${rideId}`),
        api.get(`/zem/rides/${rideId}/positions/latest`),
        api.get(`/zem/rides/${rideId}/messages`),
      ]);
      setRide(r.ride);
      setPosition(p.position);
      setMessages(m.messages || []);
      await api.patch(`/zem/rides/${rideId}/messages/read`, {});
    } catch {
      // Retry in polling
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    if (!supabase) return () => clearInterval(timer);

    const channel = supabase
      .channel(`web-ride-detail-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        ({ new: r }) => setRide(r)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_positions', filter: `ride_id=eq.${rideId}` },
        ({ new: p }) => setPosition(p)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
        ({ new: m }) =>
          setMessages((previous) => (previous.some((item) => item.id === m.id) ? previous : [...previous, m]))
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase?.removeChannel(channel);
    };
  }, [rideId]);

  // Driver continuous telemetry while viewing active ride
  useEffect(() => {
    if (!ride || !user) return;
    const isDriver = user.id === ride.zem_id;
    const activeStates = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress'];
    const isActive = activeStates.includes(ride.status);

    if (isDriver && isActive && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            await api.post('/zem/location', {
              zemId: user.id,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              isOnline: true,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading ?? null,
              speed: pos.coords.speed ?? null,
            });
          } catch {
            // Silently ignore telemetry drop
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [ride?.status, ride?.zem_id, user?.id]);

  if (!ride) {
    return (
      <div className="app-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const driver = user.id === ride.zem_id;
  const approaching = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start'].includes(ride.status);
  const activeForCancel = ['searching', 'offered', 'accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress'].includes(
    ride.status
  );

  const points =
    approaching && position
      ? [
          [position.latitude, position.longitude],
          [ride.origin_lat, ride.origin_lng],
        ]
      : [
          [ride.origin_lat, ride.origin_lng],
          [ride.dest_lat, ride.dest_lng],
        ];

  const actions: [string, string][] = [];
  if (driver && ride.status === 'accepted') actions.push(["Commencer l'approche", 'driver_en_route']);
  if (driver && ride.status === 'driver_en_route') actions.push(['Je suis arrive', 'driver_arrived']);
  if (!driver && ride.status === 'driver_arrived') actions.push(['Je suis pret', 'passenger_ready']);
  if (driver && ride.status === 'ready_to_start') actions.push(['Demarrer la course', 'start']);
  if (driver && ride.status === 'in_progress') actions.push(['Arrive a destination', 'driver_completed']);
  if (!driver && ride.status === 'driver_completed') actions.push(['Confirmer la fin', 'confirm_complete']);

  const chatOpen = ['accepted', 'driver_en_route', 'driver_arrived', 'ready_to_start', 'in_progress', 'driver_completed'].includes(
    ride.status
  );

  const act = async (actionName: string) => {
    try {
      setLoading(true);
      const { data } = await api.post(`/zem/rides/${ride.id}/action`, { action: actionName });
      setRide(data.ride);
      if (actionName === 'confirm_complete') {
        toast.success('Course terminee avec succes.');
      } else if (actionName === 'cancel') {
        toast('Course annulee.');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Action impossible.');
    } finally {
      setLoading(false);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody('');
    try {
      const { data } = await api.post(`/zem/rides/${ride.id}/messages`, {
        body: text,
        client_message_id: crypto.randomUUID(),
      });
      setMessages((previous) => (previous.some((m) => m.id === data.message.id) ? previous : [...previous, data.message]));
    } catch {
      setBody(text);
      toast.error('Message non envoye.');
    }
  };

  return (
    <div className="app-content" style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
      <button className="btn ghost mb-3" onClick={() => navigate('/zem')}>
        <ArrowLeft size={18} /> Retour au module Zem
      </button>

      <div className="lotisec-card mb-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{labels[ride.status] || ride.status}</h2>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)' }}>
            {ride.price_fcfa} FCFA
          </span>
        </div>
        <p className="text-secondary" style={{ marginTop: 4 }}>
          Distance : {ride.distance_km} km • Rôle : {driver ? 'Conducteur' : 'Passager'}
        </p>

        <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', margin: '1rem 0' }}>
          <MapContainer
            center={approaching ? [ride.origin_lat, ride.origin_lng] : [ride.dest_lat, ride.dest_lng]}
            zoom={14}
            style={{ height: '100%' }}
          >
            <TileLayer
              url="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
            <Marker position={[ride.origin_lat, ride.origin_lng]} />
            <Marker position={[ride.dest_lat, ride.dest_lng]} />
            {position && (
              <Marker
                position={[position.latitude, position.longitude]}
                icon={L.divIcon({
                  className: 'custom-zem-icon',
                  html: '<div style="background:#1565D8;width:22px;height:22px;border-radius:11px;border:3px solid white;box-shadow:0 0 10px rgba(21,101,216,0.6)"></div>',
                })}
              />
            )}
            <Polyline positions={points as any} color="#1565D8" weight={5} />
          </MapContainer>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {actions.map(([label, action]) => (
            <button key={action} className="btn primary" disabled={loading} onClick={() => act(action)}>
              <CheckCircle size={18} /> {label}
            </button>
          ))}

          {driver && ride.status === 'driver_arrived' && (
            <button
              className="btn"
              style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
              disabled={loading}
              onClick={() => act('no_show')}
            >
              <AlertTriangle size={18} /> Signaler absence passager
            </button>
          )}

          {!driver && ride.status === 'driver_completed' && (
            <button
              className="btn"
              style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
              disabled={loading}
              onClick={() => act('dispute')}
            >
              <AlertTriangle size={18} /> Contester la course
            </button>
          )}

          {activeForCancel && (
            <button className="btn danger" disabled={loading} onClick={() => act('cancel')}>
              <XOctagon size={18} /> Annuler la course
            </button>
          )}
        </div>
      </div>

      <div className="lotisec-card">
        <h3>
          <MessageCircle size={19} /> Discussion en direct
        </h3>
        <div
          style={{
            maxHeight: 280,
            minHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '0.5rem',
            backgroundColor: '#F8FAFC',
            borderRadius: 8,
            margin: '10px 0',
          }}
        >
          {messages.length === 0 ? (
            <p className="text-secondary" style={{ textAlign: 'center', margin: 'auto' }}>
              Aucun message pour le moment.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.sender_id === user.id ? 'flex-end' : 'flex-start',
                  background: message.sender_id === user.id ? 'var(--color-primary)' : '#E2E8F0',
                  color: message.sender_id === user.id ? 'white' : 'inherit',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 14,
                  maxWidth: '75%',
                }}
              >
                {message.body}
              </div>
            ))
          )}
        </div>

        {chatOpen ? (
          <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Ecrire un message..."
              maxLength={1000}
              style={{ flex: 1 }}
            />
            <button className="btn primary" aria-label="Envoyer">
              <Send size={18} />
            </button>
          </form>
        ) : (
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            La discussion est disponible uniquement pendant la course active.
          </p>
        )}
      </div>
    </div>
  );
}
