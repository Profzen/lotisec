import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { User, Car, ChevronRight, Phone, Flame } from 'lucide-react';

type UserData = {
  id: string;
  phone: string;
  qr_token?: string;
};

export function Home() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? (JSON.parse(raw) as UserData) : null;
  }, []);
  
  const [loadingSOS, setLoadingSOS] = useState(false);

  const sendSOS = async () => {
    if (!navigator.geolocation) {
      alert('Géolocalisation non supportée par votre navigateur.');
      return;
    }

    setLoadingSOS(true);
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
          alert('SOS envoyé ! Les secours ont reçu votre position.');
        } catch {
          alert('Échec de l\'envoi du SOS.');
        } finally {
          setLoadingSOS(false);
        }
      },
      () => {
        setLoadingSOS(false);
        alert('Position GPS refusée.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <>
      {/* Top Header */}
      <div className="top-header">
        <div className="top-header-title">LOTI<span>SEC</span></div>
        <div className="profile-avatar">
          <User size={24} />
        </div>
      </div>

      {/* SOS Area (Green background) */}
      <div className="sos-container">
        <div className="sos-radar">
          <div className="sos-ring sos-ring-1"></div>
          <div className="sos-ring sos-ring-2"></div>
          <div className="sos-ring sos-ring-3"></div>
          <button 
            className="sos-btn-huge" 
            onClick={sendSOS} 
            disabled={loadingSOS}
          >
            <div className="sos-text-main">SOS</div>
            <div className="sos-text-sub">URGENCE</div>
          </button>
        </div>
        <div className="sos-instruction">DÉCLENCHER LE SOS</div>
      </div>

      {/* White Bottom Sheet Content */}
      <div className="white-sheet">
        
        {/* Zem Section */}
        <div>
          <div className="lotisec-card-header">DÉPLACEMENT & ZEM</div>
          <div className="action-item" onClick={() => navigate('/map')}>
            <div className="action-icon green">
              <Car size={24} />
            </div>
            <div className="action-content">
              <div className="action-title">Commander un Zem</div>
              <div className="action-subtitle">Trouvez un conducteur à proximité</div>
            </div>
            <ChevronRight size={20} color="#9ca3af" />
          </div>
        </div>

        {/* Emergency Contacts Section */}
        <div>
          <div className="lotisec-card-header">CONTACTS D'URGENCE</div>
          <div className="lotisec-card">
            <div className="contact-list">
              
              <div className="contact-item">
                <div className="contact-avatar" style={{ backgroundColor: '#f59e0b' }}>
                  <Flame size={20} />
                </div>
                <div className="action-content">
                  <div className="action-title">Sapeurs-Pompiers</div>
                  <div className="action-subtitle">118</div>
                </div>
                <button className="action-btn" onClick={() => window.location.href = 'tel:118'}>
                  <Phone size={20} />
                </button>
              </div>

              <div className="contact-item">
                <div className="contact-avatar" style={{ backgroundColor: '#ef4444' }}>
                  <User size={20} />
                </div>
                <div className="action-content">
                  <div className="action-title">A prévenir</div>
                  <div className="action-subtitle">+22891127584</div>
                </div>
                <button className="action-btn" onClick={() => window.location.href = 'tel:+22891127584'}>
                  <Phone size={20} />
                </button>
              </div>

              <div className="contact-item">
                <div className="contact-avatar" style={{ backgroundColor: '#eab308' }}>
                  <User size={20} />
                </div>
                <div className="action-content">
                  <div className="action-title">A prévenir</div>
                  <div className="action-subtitle">+22898000493</div>
                </div>
                <button className="action-btn" onClick={() => window.location.href = 'tel:+22898000493'}>
                  <Phone size={20} />
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </>
  );
}
