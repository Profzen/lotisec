import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authHeaders } from '../api/client';
import QRCode from 'react-qr-code';
import { User, Car, ChevronRight, Phone, Flame, Lock, Eye, CheckCircle2, ShieldAlert, ArrowRight, X, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type UserData = {
  id: string;
  phone: string;
  qr_token?: string;
  is_zem?: boolean;
};

const CONTACTS = [
  { id: '0', name: 'Sapeurs-Pompiers', phone: '118', isPompiers: true, color: '#f59e0b', icon: <Flame size={20} /> },
  { id: '1', name: 'A prévenir', phone: '+22891127584', isPompiers: false, color: '#ef4444', icon: <User size={20} /> },
  { id: '2', name: 'A prévenir', phone: '+22898000493', isPompiers: false, color: '#eab308', icon: <User size={20} /> },
];

const DEMO_SCANS = [
  { id: '1', date: "Aujourd'hui · 10h32", lieu: 'Université de Lomé', niveau: 'professionnel' },
  { id: '2', date: '17 Avr · 09h15', lieu: 'Lomé, Bè', niveau: 'professionnel' },
  { id: '3', date: '10 Avr · 17h40', lieu: 'Lomé, Tokoin', niveau: 'public' },
];

export function Home() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? (JSON.parse(raw) as UserData) : null;
  }, []);
  
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [sosActif, setSosActif] = useState(false);
  const [showScans, setShowScans] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const handleSOS = () => {
    if (sosActif) {
      if(window.confirm("Annuler l'alerte ? Les secours ont déjà été notifiés.")) {
        setSosActif(false);
      }
    } else {
      if(window.confirm("🚨 SOS IMMÉDIAT\nVotre position sera envoyée à votre contact d'urgence via WhatsApp.")) {
        sendSOS();
      }
    }
  };

  const sendSOS = async () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée par votre navigateur.');
      return;
    }

    setLoadingSOS(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          // Attempt API calls without blocking WA
          await api.post('/api/v1/incidents', {
            source: 'web', type: 'SOS citoyen', severity: 'critical', latitude, longitude,
            accuracy: position.coords.accuracy || 0, address: 'Position GPS web', victims: 1,
            vehicles: 0, description: 'SOS déclenché depuis le portail citoyen', qr_token: user?.qr_token,
            client_event_id: `web-${user?.id || 'anonymous'}-${Date.now()}`
          }, { headers: authHeaders() });

          setSosActif(true);
          toast.success('SOS transmis au centre de supervision LOTISEC.');
          const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          const message = `🚨 *URGENCE SOS - LOTISEC* 🚨\n\nBonjour! Je suis en danger. J'ai besoin d'aide immédiatement, s'il vous plaît !\n\n📍 Voici ma position actuelle : ${mapsUrl}`;
          const phone = CONTACTS[1].phone.replace(/[^\d+]/g, "");
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');

        } catch {
          toast.error("Erreur réseau lors de l'envoi du SOS.");
        } finally {
          setLoadingSOS(false);
        }
      },
      () => {
        setLoadingSOS(false);
        toast.error('Position GPS refusée. Impossible d\'envoyer la position.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const generatePDF = () => {
    window.print();
  };

  return (
    <>
      <div className="top-header" style={{ backgroundColor: sosActif ? 'var(--color-danger)' : 'var(--color-primary)' }}>
        <div className="top-header-title">Safe<span style={{color: '#FFD100'}}>Life</span></div>
        <div className="profile-avatar" onClick={() => document.getElementById('profile-drawer')?.classList.add('open')}>
          <User size={24} />
        </div>
      </div>

      <div className="sos-container" style={{ backgroundColor: sosActif ? 'var(--color-danger)' : 'var(--color-primary)' }}>
        <div className="sos-radar">
          <div className="sos-ring sos-ring-1" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.4)' : 'rgba(255, 255, 255, 0.15)' }}></div>
          <div className="sos-ring sos-ring-2" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.3)' : 'rgba(255, 255, 255, 0.2)' }}></div>
          <div className="sos-ring sos-ring-3" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.3)' }}></div>
          <button 
            className="sos-btn-huge" 
            onClick={handleSOS} 
            disabled={loadingSOS}
            style={{ backgroundColor: sosActif ? '#B71C1C' : 'var(--color-danger)' }}
          >
            <div className="sos-text-main">SOS</div>
            <div className="sos-text-sub">{sosActif ? 'ANNULER' : 'URGENCE'}</div>
          </button>
        </div>
        <div className="sos-instruction">{sosActif ? 'APPUYER POUR ANNULER' : 'DÉCLENCHER LE SOS'}</div>
      </div>

      <div className="white-sheet">
        
        {sosActif && (
          <div className="lotisec-card" style={{ borderColor: 'var(--color-danger)', borderWidth: 1, borderStyle: 'solid' }}>
            <div className="lotisec-card-header" style={{ color: 'var(--color-danger)' }}>ACTIONS RECOMMANDÉES</div>
            <div className="action-item" onClick={() => window.open('https://www.google.com/maps/search/hopital', '_blank')} style={{ backgroundColor: 'rgba(210,16,52,0.05)', border: 'none' }}>
              <div className="action-icon green"><Flame size={20} /></div>
              <div className="action-content">
                <div className="action-title" style={{ color: 'var(--color-primary)' }}>Hôpital le plus proche</div>
                <div className="action-subtitle">Afficher l'itinéraire GPS</div>
              </div>
              <ChevronRight size={20} color="#9ca3af" />
            </div>
          </div>
        )}

        <div>
          <div className="lotisec-card-header">ALERTES RAPIDES & ASSISTANCE</div>
          
          <div className="action-item" onClick={() => navigate('/assistant')} style={{ backgroundColor: 'rgba(21,101,216,0.05)', border: 'none', marginBottom: '8px' }}>
            <div className="action-icon green" style={{ backgroundColor: 'var(--color-primary)' }}><MessageCircle size={20} color="white" /></div>
            <div className="action-content">
              <div className="action-title" style={{ color: 'var(--color-primary)' }}>Assistant IA LOTISEC</div>
              <div className="action-subtitle" style={{ color: 'var(--color-primary)', opacity: 0.7 }}>Vos questions sur le code de la route</div>
            </div>
            <ChevronRight size={20} color="#9ca3af" />
          </div>

          <div className="action-item" onClick={handleSOS} style={{ backgroundColor: 'rgba(210,16,52,0.05)', border: 'none' }}>
            <div className="action-icon red"><ShieldAlert size={20} /></div>
            <div className="action-content">
              <div className="action-title" style={{ color: 'var(--color-danger)' }}>Alerter mes contacts</div>
              <div className="action-subtitle" style={{ color: 'var(--color-danger)', opacity: 0.6 }}>WhatsApp + Position GPS</div>
            </div>
            <ChevronRight size={20} color="#9ca3af" />
          </div>
        </div>

        <div>
          <div className="lotisec-card-header">DÉPLACEMENT & ZEM</div>
          <div className="lotisec-card" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="action-item" onClick={() => navigate('/map')} style={{ border: 'none', padding: '0.5rem' }}>
              <div className="action-icon green"><Car size={24} /></div>
              <div className="action-content">
                <div className="action-title">Commander un Zem</div>
                <div className="action-subtitle">Trouvez un conducteur à proximité</div>
              </div>
              <ChevronRight size={20} color="#9ca3af" />
            </div>
            
            {user?.is_zem && (
              <div className="action-item" onClick={() => navigate('/driver')} style={{ border: 'none', padding: '0.5rem', backgroundColor: 'rgba(0,200,83,0.05)' }}>
                <div className="action-icon" style={{ backgroundColor: 'var(--color-success)' }}><CheckCircle2 size={24} /></div>
                <div className="action-content">
                  <div className="action-title" style={{ color: 'var(--color-success)' }}>Mode Conducteur</div>
                  <div className="action-subtitle" style={{ color: 'var(--color-success)', opacity: 0.7 }}>Recevoir des courses</div>
                </div>
                <ChevronRight size={20} color="#9ca3af" />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="lotisec-card-header">CONTACTS D'URGENCE</div>
          <div className="lotisec-card">
            <div className="contact-list">
              {CONTACTS.map((c, i) => (
                <div className="contact-item" key={c.id}>
                  <div className="contact-avatar" style={{ backgroundColor: c.color }}>{c.icon}</div>
                  <div className="action-content">
                    <div className="action-title">{c.name}</div>
                    <div className="action-subtitle">{c.phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => window.open(`tel:${c.phone}`)}>
                      <Phone size={16} />
                    </button>
                    {!c.isPompiers && (
                      <button className="action-btn" style={{ backgroundColor: '#e2f5ea', color: '#128c7e' }} onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d+]/g, "")}`, '_blank')}>
                        <MessageCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lotisec-card" onClick={() => setQrModalVisible(true)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
          <div style={{ width: 50, height: 50, borderRadius: 10, border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user?.qr_token ? <QRCode value={`https://qr-web-dbap.vercel.app/scan/${user.qr_token}`} size={34} fgColor="var(--color-primary)" /> : <div>...</div>}
          </div>
          <div className="action-content">
            <div className="action-title">Mon QR code</div>
            <div className="action-subtitle">Agrandir ou télécharger le PDF</div>
          </div>
          <ChevronRight size={20} color="#9ca3af" />
        </div>

        <div className="lotisec-card">
          <div className="lotisec-card-header" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowScans(!showScans)}>
            HISTORIQUE DES SCANS
            <ChevronRight size={16} style={{ transform: showScans ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          
          {showScans && (
            <div className="contact-list" style={{ marginTop: '1rem' }}>
              {DEMO_SCANS.map(scan => (
                <div className="contact-item" key={scan.id} style={{ padding: '0.5rem 0' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                    {scan.niveau === 'professionnel' ? <Lock size={16} /> : <Eye size={16} />}
                  </div>
                  <div className="action-content">
                    <div className="action-title" style={{ fontSize: '0.875rem' }}>{scan.date}</div>
                    <div className="action-subtitle">{scan.lieu}</div>
                  </div>
                  <div style={{ padding: '4px 8px', backgroundColor: scan.niveau === 'professionnel' ? 'rgba(0,106,78,0.1)' : '#f3f4f6', color: scan.niveau === 'professionnel' ? 'var(--color-primary)' : '#6b7280', fontSize: '0.7rem', borderRadius: '10px', fontWeight: 'bold' }}>
                    {scan.niveau}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Profile Drawer */}
      <div id="profile-drawer" className="profile-drawer">
        <div className="profile-drawer-content">
          <div className="drawer-header">
            <h3>Mon Profil</h3>
            <button className="action-btn" onClick={() => document.getElementById('profile-drawer')?.classList.remove('open')}><X size={20} /></button>
          </div>
          <div className="drawer-body">
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: 80, height: 80, backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold' }}>
                <User size={40} />
              </div>
              <h2 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>{user?.phone || 'Utilisateur'}</h2>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Compte Actif</div>
            </div>
            
            <div className="lotisec-card">
              <div className="contact-item">
                <div style={{ flex: 1 }}>
                  <div className="action-title">Déconnexion</div>
                  <div className="action-subtitle">Quitter votre session sécurisée</div>
                </div>
                <button className="btn danger" style={{ width: 'auto' }} onClick={() => {
                  localStorage.removeItem('lotisec_token');
                  localStorage.removeItem('lotisec_user');
                  window.location.href = '/login';
                }}>Déconnexion</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrModalVisible && (
        <div className="qr-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setQrModalVisible(false); }}>
          <div className="qr-modal-content">
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Mon Code QR</h2>
            <div id="print-qr-area" style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '1rem', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
               {user?.qr_token ? <QRCode value={`https://lotisec.com/scan/${user.qr_token}`} size={220} /> : <div>Chargement...</div>}
            </div>
            <button className="btn primary" onClick={generatePDF}>📄 Imprimer / PDF</button>
            <button className="btn ghost mt-4" onClick={() => setQrModalVisible(false)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
