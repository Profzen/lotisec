import React, { useState, useMemo } from 'react';
import { api, authHeaders } from '../api/client';
import { ShieldAlert, Activity, Heart, Info, MapPin } from 'lucide-react';

type UserData = {
  id: string;
  phone: string;
  qr_token?: string;
};

type Hospital = {
  nom: string;
  distance_km?: number;
  telephone?: string;
};

export function Home() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? (JSON.parse(raw) as UserData) : null;
  }, []);
  
  const [message, setMessage] = useState('Prêt pour une urgence.');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingSOS, setLoadingSOS] = useState(false);

  const detectHospitals = async (lat: number, lng: number) => {
    try {
      const { data } = await api.get('/geo/hopital-proche', { params: { lat, lng } });
      setHospitals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const sendSOS = async () => {
    if (!navigator.geolocation) {
      setMessage('Géolocalisation non supportée par votre navigateur.');
      return;
    }

    setLoadingSOS(true);
    setMessage('Détection GPS en cours...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          await Promise.allSettled([
            api.post('/accidents', {
              latitude,
              longitude,
              user_id: user?.id,
              qr_token: user?.qr_token,
              vehicle_type: 'moto'
            }),
            api.post('/alertes', {
              latitude,
              longitude,
              user_id: user?.id,
              qr_token: user?.qr_token,
              prenom: 'Utilisateur',
              nom: 'LOTISEC Web',
              groupe_sanguin: '?',
              adresse: 'Position GPS web'
            })
          ]);

          await detectHospitals(latitude, longitude);
          setMessage('SOS envoyé avec succès. Secours notifiés.');
        } catch {
          setMessage('Échec de l\'envoi du SOS. Vérifiez votre connexion.');
        } finally {
          setLoadingSOS(false);
        }
      },
      () => {
        setLoadingSOS(false);
        setMessage('Position GPS refusée ou indisponible.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Profil Header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '50%' }}>
          <ShieldAlert size={32} />
        </div>
        <div>
          <h2 style={{ color: 'white', margin: 0 }}>ID Lotisec: {user?.id.split('-')[0]}</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>Tel: {user?.phone}</p>
        </div>
      </div>

      {/* SOS Section */}
      <div className="card text-center">
        <h2>Urgence Médicale</h2>
        <p>{message}</p>
        <button 
          className="sos-btn-huge" 
          onClick={sendSOS} 
          disabled={loadingSOS}
        >
          {loadingSOS ? <Activity className="animate-spin" size={48} /> : 'SOS'}
        </button>
        <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
          Un appui enverra votre position exacte aux urgences.
        </p>
      </div>

      {/* Hôpitaux Proches */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="text-primary" size={24} />
          <h2 style={{ margin: 0 }}>Hôpitaux recommandés</h2>
        </div>
        {hospitals.length === 0 ? (
          <p className="text-center" style={{ padding: '2rem 0', color: 'var(--color-text-secondary)' }}>
            Déclenchez un SOS pour obtenir les recommandations d'hôpitaux les plus proches.
          </p>
        ) : (
          <div className="flex flex-col">
            {hospitals.map((h, i) => (
              <div key={`${h.nom}-${i}`} className="list-item">
                <div>
                  <div className="list-item-title">{h.nom}</div>
                  <div className="list-item-subtitle">{h.telephone || 'Pas de numéro'}</div>
                </div>
                <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {h.distance_km ? `${h.distance_km} km` : '-'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conseils */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Info className="text-primary" size={24} />
          <h2 style={{ margin: 0 }}>Conseils sécurité</h2>
        </div>
        <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li>Portez toujours le casque et gardez vos papiers à jour.</li>
          <li>Partagez votre QR personnel avec vos proches.</li>
          <li>En cas d'accident, sécurisez d'abord la zone avant de porter secours.</li>
        </ul>
      </div>
    </div>
  );
}
