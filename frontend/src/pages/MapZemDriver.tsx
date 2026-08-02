import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ChevronLeft } from 'lucide-react';
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
  const [currentOffer,setCurrentOffer]=useState<any>(null);
  const loadOffer=async()=>{try{const {data}=await api.get('/zem/offers/current');setCurrentOffer(data.offers?.[0]||null);}catch{/* reprise au prochain passage */}};

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

  useEffect(()=>{loadOffer();const timer=window.setInterval(loadOffer,7000);return()=>window.clearInterval(timer);},[]);

  // Écoute privée des offres via Supabase
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel('private:ride-offers:driver')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_offers', filter: `zem_id=eq.${user.id}` }, loadOffer)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `zem_id=eq.${user.id}` }, payload => {
        if (payload.new.status === 'canceled' && activeRide?.id === payload.new.id) {
          toast("La course a été annulée par le client.", { icon: 'ℹ️' });
          setActiveRide(null);
          setRouteData(null);
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [user, activeRide]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptRide = async (offer: any) => {
    try {
      const { data: response } = await api.post(`/zem/offers/${offer.id}/respond`, { decision: 'accept' });
      const data = response.ride;
      setActiveRide(data);
      setCurrentOffer(null);
      
      setIsOnline(false);
      if (location) updateZemLocation(location.lat, location.lng, false);

      const rData = await getRoute(
        { latitude: data.origin_lat, longitude: data.origin_lng },
        { latitude: data.dest_lat, longitude: data.dest_lng }
      );
      setRouteData(rData);

    } catch (err) {
      toast.error("Impossible d'accepter la course.");
    }
  };

  const declineRide = async (offerId: string) => {
    try {
      await api.post(`/zem/offers/${offerId}/respond`, { decision: 'decline' });
      setCurrentOffer(null);await loadOffer();
    } catch (err) {
      console.error(err);
    }
  };

  const nextAction:Record<string,{label:string,action:string}>={accepted:{label:"Commencer l'approche",action:'driver_en_route'},driver_en_route:{label:'Je suis arrivé',action:'driver_arrived'},ready_to_start:{label:'Démarrer le trajet',action:'start'},in_progress:{label:'Arrivé à destination',action:'driver_completed'}};
  const advance=async()=>{const next=nextAction[activeRide?.status];if(!next)return;try{const {data}=await api.post(`/zem/rides/${activeRide.id}/action`,{action:next.action});setActiveRide(data.ride);}catch{toast.error('Cette action n’est pas disponible.');}};

  const toggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (location && user) {
      updateZemLocation(location.lat, location.lng, newStatus);
    }
  };

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
      <button 
        onClick={() => window.history.back()} 
        style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1100, backgroundColor: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', cursor: 'pointer' }}
      >
        <ChevronLeft size={24} color="var(--color-primary)" />
      </button>

      {loading && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p className="mt-4" style={{color: 'var(--color-primary)', fontWeight: 'bold'}}>Chargement...</p>
        </div>
      )}

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000, backgroundColor: 'white', padding: '10px', borderRadius: '10px', fontWeight: 'bold' }}>
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
        {currentOffer ? <div><h3>Nouvelle proposition</h3><p>{currentOffer.distance_km} km · {currentOffer.price_fcfa} FCFA</p><div style={{display:'flex',gap:'0.75rem'}}><button className="btn" style={{background:'var(--color-danger)',color:'white'}} onClick={()=>declineRide(currentOffer.id)}>Refuser</button><button className="btn" style={{background:'var(--color-success)',color:'white'}} onClick={()=>acceptRide(currentOffer)}>Accepter</button></div></div> : !activeRide ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-danger)' }} />
              <span style={{ fontWeight: 'bold' }}>{isOnline ? "En Ligne - Prêt" : "Hors Ligne"}</span>
            </div>
            
            {/* Warning that web geolocation is fragile */}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: '1rem' }}>
              Sur le web, gardez cette page ouverte pour que votre position soit envoyée aux passagers.
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
            {nextAction[activeRide.status]?<button className="btn primary" onClick={advance}>{nextAction[activeRide.status].label}</button>:<p>En attente de l’action du passager.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
