import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, authHeaders } from '../api/client';
import QRCode from 'react-qr-code';
import { User, Car, ChevronRight, Phone, Flame, Lock, Eye, CheckCircle2, ShieldAlert, ArrowRight, X, MessageCircle, Loader2 } from 'lucide-react';
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

export function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? (JSON.parse(raw) as UserData) : null;
  });
  
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [sosActif, setSosActif] = useState(false);
  const [showScans, setShowScans] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [scans, setScans] = useState<any[]>([]);
  const [scansLoaded, setScansLoaded] = useState(false);

  useEffect(() => {
    const refreshUser = async () => {
      if (!user?.qr_token) {
        try {
          const { data } = await api.get('/auth/me', { headers: authHeaders() });
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('lotisec_user', JSON.stringify(data.user));
          }
        } catch (e) {
          console.warn('Erreur refresh user:', e);
        }
      }
    };
    refreshUser();
    api.get('/scan/me', { headers: authHeaders() })
      .then(({data}) => setScans(data?.items || []))
      .catch(() => setScans([]))
      .finally(() => setScansLoaded(true));
  }, []);

  const [sosIncidentId, setSosIncidentId] = useState<string | null>(null);
  const [sosClientEventId, setSosClientEventId] = useState<string | null>(null);
  const [assignedUnit, setAssignedUnit] = useState<any>(null);
  const [assignedHospital, setAssignedHospital] = useState<any>(null);
  const [dispatchStatus, setDispatchStatus] = useState<'awaiting_dispatch' | 'recommended' | 'assigned'>('awaiting_dispatch');
  const [showComplementModal, setShowComplementModal] = useState(false);
  const [showConfirmSOSModal, setShowConfirmSOSModal] = useState(false);
  const [showCancelSOSModal, setShowCancelSOSModal] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [complementType, setComplementType] = useState('Accident routier');
  const [complementVictims, setComplementVictims] = useState('Je ne sais pas');
  const [complementDangers, setComplementDangers] = useState<string[]>([]);
  const [complementVehicles, setComplementVehicles] = useState('Je ne sais pas');
  const [complementLoading, setComplementLoading] = useState(false);
  const [complementDone, setComplementDone] = useState(false);

  // Polling du statut réel côté régulation
  useEffect(() => {
    if (!sosActif || !sosIncidentId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/v1/incidents/${sosIncidentId}/status`, { headers: authHeaders() });
        if (data?.incident) {
          if (data.incident.status === 'cancelled' || data.incident.status === 'rejected') {
            setSosActif(false);
            setSosIncidentId(null);
            setWhatsappUrl(null);
            toast('Le signalement a été clôturé ou rejeté.');
          } else if (data.incident.status === 'assigned') {
            setDispatchStatus('assigned');
          }
        }
        if (data?.intervention?.unit_name) {
          setAssignedUnit({ name: data.intervention.unit_name, type: data.intervention.unit_type, phone: data.intervention.unit_phone || '118' });
          setDispatchStatus('assigned');
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [sosActif, sosIncidentId]);

  const handleSOS = () => {
    if (sosActif) {
      setShowCancelSOSModal(true);
    } else {
      setShowConfirmSOSModal(true);
    }
  };

  const annulerSOS = async () => {
    setShowCancelSOSModal(false);
    if (sosIncidentId) {
      try {
        await api.patch(`/api/v1/incidents/${sosIncidentId}/status`, {
          status: 'cancelled',
          client_event_id: sosClientEventId
        }, { headers: authHeaders() });
        toast.success("Signalement annulé auprès de la supervision.");
      } catch (err: any) {
        console.error('[SOS CANCEL ERROR]', err?.response?.status, err?.response?.data, err?.message);
        toast.error("Erreur lors de l'annulation serveur.");
      }
    }
    setSosActif(false);
    setSosIncidentId(null);
    setAssignedUnit(null);
    setAssignedHospital(null);
    setComplementDone(false);
    setWhatsappUrl(null);
  };

  const sendSOS = async () => {
    setShowConfirmSOSModal(false);
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée sur ce navigateur. Appelez directement le 118.');
      return;
    }

    setLoadingSOS(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const clientEventId = `web-${user?.id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        try {
          const { data } = await api.post('/api/v1/incidents', {
            source: 'web',
            type: 'Urgence citoyenne',
            severity: 'unknown',
            latitude,
            longitude,
            accuracy: position.coords.accuracy || 0,
            address: 'Position GPS transmise par le portail web',
            victims: 0,
            vehicles: 0,
            flags: ['details_pending', 'victims_unknown', 'vehicles_unknown'],
            qr_token: user?.qr_token,
            client_event_id: clientEventId
          }, { headers: authHeaders() });

          const incId = data?.incident?.id || null;
          setSosIncidentId(incId);
          setSosClientEventId(clientEventId);
          setAssignedUnit(data?.closest_unit || null);
          setAssignedHospital(data?.closest_hospital || null);
          setDispatchStatus(data?.dispatch_status || 'awaiting_dispatch');
          setSosActif(true);
          toast.success('Alerte reçue par LOTISEC. En attente de validation.');
          setShowComplementModal(true);

          // Préparation de l'alerte WhatsApp pour transmission volontaire
          const mapsUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
          const message = `🚨 *URGENCE SOS - LOTISEC* 🚨\n\nBonjour ! Je signale une urgence. Voici ma position actuelle : ${mapsUrl}`;
          const phone = CONTACTS[1].phone.replace(/[^\d+]/g, "");
          setWhatsappUrl(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);

        } catch (err: any) {
          console.error('[SOS ERROR] status:', err?.response?.status, 'detail:', err?.response?.data, 'code:', err?.code, 'message:', err?.message);
          if (err?.response?.status === 400) {
            const detailMsg = err.response?.data?.detail || err.response?.data?.error || 'Requête d’urgence invalide. Appelez le 118.';
            toast.error(detailMsg);
          } else {
            toast.error('Impossible de contacter le centre de supervision. Appelez directement le 118.');
          }
        } finally {
          setLoadingSOS(false);
        }
      },
      (geoErr) => {
        setLoadingSOS(false);
        console.error('[GEOLOCATION ERROR]', geoErr.code, geoErr.message);
        if (geoErr.code === 1) {
          toast.error('La géolocalisation a été refusée. Activez le GPS ou appelez le 118.');
        } else if (geoErr.code === 3) {
          toast.error('Délai de géolocalisation dépassé. Veuillez réessayer ou appeler le 118.');
        } else {
          toast.error('Position GPS indisponible. Vous pouvez contacter directement le 118.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const envoyerComplement = async () => {
    if (!sosIncidentId) return;
    setComplementLoading(true);
    try {
      let victimsNum = 0;
      if (complementVictims === '1') victimsNum = 1;
      else if (complementVictims === '2 à 5') victimsNum = 3;
      else if (complementVictims === '+ de 5') victimsNum = 6;
      let vehiclesNum = 0;
      if (complementVehicles === '1') vehiclesNum = 1;
      else if (complementVehicles === '2') vehiclesNum = 2;
      else if (complementVehicles === 'Plusieurs') vehiclesNum = 3;

      const flags = [...complementDangers];
      if (complementVictims === 'Je ne sais pas') flags.push('victims_unknown');
      if (complementVehicles === 'Je ne sais pas') flags.push('vehicles_unknown');

      await api.patch(`/api/v1/incidents/${sosIncidentId}/report`, {
        type: complementType,
        victims: victimsNum,
        vehicles: vehiclesNum,
        flags,
        client_event_id: sosClientEventId
      }, { headers: authHeaders() });

      toast.success("Précisions transmises à la régulation.");
      setComplementDone(true);
      setShowComplementModal(false);
    } catch {
      toast.error("Erreur lors de l'envoi des précisions.");
    } finally {
      setComplementLoading(false);
    }
  };

  const generatePDF = () => {
    window.print();
  };

  return (
    <>
      <div className="top-header" style={{ backgroundColor: sosActif ? 'var(--color-danger)' : 'var(--color-header)' }}>
        <div className="web-wordmark"><img src="/logo-118.png" alt="" /><span>LOTI<strong>SEC</strong></span></div>
        <div className="profile-avatar" onClick={() => document.getElementById('profile-drawer')?.classList.add('open')}>
          <User size={24} />
        </div>
      </div>

      <div className="sos-container" style={{ backgroundColor: sosActif ? 'var(--color-danger)' : 'var(--color-header)' }}>
        <div className="sos-radar">
          <div className="sos-ring sos-ring-1" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.4)' : 'rgba(255, 255, 255, 0.15)' }}></div>
          <div className="sos-ring sos-ring-2" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.3)' : 'rgba(255, 255, 255, 0.2)' }}></div>
          <div className="sos-ring sos-ring-3" style={{ backgroundColor: sosActif ? 'rgba(255,255,255,0.2)' : 'rgba(255, 255, 255, 0.3)' }}></div>
          <button 
            className="sos-btn-huge" 
            onClick={handleSOS} 
            disabled={loadingSOS}
            style={{ 
              backgroundColor: sosActif ? '#B71C1C' : 'var(--color-danger)',
              cursor: loadingSOS ? 'not-allowed' : 'pointer',
              opacity: loadingSOS ? 0.9 : 1,
            }}
          >
            {loadingSOS ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '0 8px' }}>
                <Loader2 size={34} style={{ animation: 'spin 1s linear infinite' }} />
                <div className="sos-text-main" style={{ fontSize: '0.95rem', letterSpacing: '0.5px' }}>LOCALISATION...</div>
                <div className="sos-text-sub" style={{ fontSize: '0.62rem' }}>Recherche de votre position</div>
              </div>
            ) : (
              <>
                <div className="sos-text-main">SOS</div>
                <div className="sos-text-sub">{sosActif ? 'ANNULER' : 'URGENCE'}</div>
              </>
            )}
          </button>
        </div>
        <div className="sos-instruction">
          {loadingSOS
            ? 'Recherche de votre position GPS en cours...'
            : sosActif
            ? 'SIGNALEMENT ACTIF · CLIQUER POUR ANNULER'
            : 'DÉCLENCHER LE SOS'}
        </div>
      </div>

      <div className="white-sheet">
        
        {sosActif && (
          <div className="lotisec-card" style={{ borderColor: 'var(--color-danger)', borderWidth: 1.5, borderStyle: 'solid', padding: '14px', backgroundColor: '#fff' }}>
            <div className="lotisec-card-header" style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
              {dispatchStatus === 'assigned' ? 'UNITÉ DE SECOURS AFFECTÉE' : 'SIGNALEMENT TRANSMIS · EN ATTENTE DE VALIDATION'}
            </div>
            
            {assignedUnit ? (
              <div style={{ backgroundColor: 'rgba(21,101,216,0.06)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{dispatchStatus === 'assigned' ? 'Unité affectée' : 'Unité recommandée'}</div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{assignedUnit.name}</div>
                <div style={{ fontSize: '12px', color: dispatchStatus === 'assigned' ? '#16a34a' : '#d97706' }}>
                  {dispatchStatus === 'assigned' ? 'Mission en cours' : 'Disponibilité à confirmer par la régulation'}
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: 'rgba(21,101,216,0.04)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>En attente d'affectation</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Votre alerte est enregistrée au centre de régulation LOTISEC.</div>
              </div>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#25D366',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                }}
              >
                <MessageCircle size={18} />
                Prévenir mon contact WhatsApp
              </a>
            )}

            {!complementDone && (
              <button
                onClick={() => setShowComplementModal(true)}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px' }}
              >
                Compléter l'alerte (victimes, dangers…)
              </button>
            )}

            <div className="action-item" onClick={() => window.open('https://www.google.com/maps/search/hopital', '_blank')} style={{ backgroundColor: 'rgba(210,16,52,0.05)', border: 'none' }}>
              <div className="action-icon green"><Flame size={20} /></div>
              <div className="action-content">
                <div className="action-title" style={{ color: 'var(--color-primary)' }}>{assignedHospital?.name || 'Hôpital le plus proche'}</div>
                <div className="action-subtitle">Afficher l'itinéraire d'urgence</div>
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
            {user?.qr_token ? <QRCode value={`${window.location.origin}/scan/${user.qr_token}`} size={34} fgColor="var(--color-primary)" /> : <div>...</div>}
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
              {scans.map(scan => (
                <div className="contact-item" key={scan.id} style={{ padding: '0.5rem 0' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                    <Lock size={16} />
                  </div>
                  <div className="action-content">
                    <div className="action-title" style={{ fontSize: '0.875rem' }}>{new Date(scan.created_at).toLocaleString('fr-TG')}</div>
                    <div className="action-subtitle">{scan.authority || scan.actor_role || 'Accès autorisé'}</div>
                  </div>
                  <div style={{ padding: '4px 8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: '0.7rem', borderRadius: '10px', fontWeight: 'bold' }}>
                    {scan.success ? 'autorisé' : 'refusé'}
                  </div>
                </div>
              ))}
              {scansLoaded && scans.length === 0 && <div className="empty-inline">Aucun accès à votre fiche n'a encore été enregistré.</div>}
              {!scansLoaded && <div className="empty-inline">Chargement de l'historique…</div>}
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
              <button className="btn primary" style={{width:'100%',marginBottom:'1rem'}} onClick={()=>navigate('/profil')}>Modifier mon profil médical</button>
              <div className="contact-item">
                <div style={{ flex: 1 }}>
                  <div className="action-title">Déconnexion</div>
                  <div className="action-subtitle">Quitter votre session sécurisée</div>
                </div>
                <button className="btn danger" style={{ width: 'auto' }} onClick={async () => {
                  await api.post('/auth/logout',{}).catch(()=>null);
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
               {user?.qr_token ? <QRCode value={`${window.location.origin}/scan/${user.qr_token}`} size={220} /> : <div>Chargement...</div>}
            </div>
            <button className="btn primary" onClick={generatePDF}>Imprimer / PDF</button>
            <button className="btn ghost mt-4" onClick={() => setQrModalVisible(false)}>Fermer</button>
          </div>
        </div>
      )}

      {/* Complement Modal */}
      {showComplementModal && (
        <div className="qr-modal-overlay" style={{ zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowComplementModal(false); }}>
          <div className="qr-modal-content" style={{ maxWidth: '420px', width: '90%' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--color-primary)' }}>Précisions d'urgence (facultatif)</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Votre alerte est déjà transmise. Ces informations aident la régulation à calibrer les secours.
            </p>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Type d'événement</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Accident routier', 'Malaise / Inconscience', 'Incendie', 'Chute / Traumatisme', 'Autre'].map((t) => {
                  const active = complementType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setComplementType(t)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        border: active ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                        backgroundColor: active ? 'var(--color-primary)' : '#f8fafc',
                        color: active ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Victimes</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Je ne sais pas', '1', '2 à 5', '+ de 5'].map((v) => {
                  const active = complementVictims === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setComplementVictims(v)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        border: active ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                        backgroundColor: active ? 'var(--color-primary)' : '#f8fafc',
                        color: active ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Véhicules</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Aucun', '1', '2', 'Plusieurs', 'Je ne sais pas'].map((vh) => {
                  const active = complementVehicles === vh;
                  return (
                    <button
                      key={vh}
                      type="button"
                      onClick={() => setComplementVehicles(vh)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        border: active ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                        backgroundColor: active ? 'var(--color-primary)' : '#f8fafc',
                        color: active ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {vh}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Dangers constatés (multi-sélection)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { label: 'Inconscience', flag: 'inconscience' },
                  { label: 'Saignement grave', flag: 'saignement' },
                  { label: 'Victime coincée', flag: 'coince' },
                  { label: 'Feu / Fumée', flag: 'feu' },
                ].map((d) => {
                  const active = complementDangers.includes(d.flag);
                  return (
                    <button
                      key={d.flag}
                      type="button"
                      onClick={() => {
                        setComplementDangers(active ? complementDangers.filter((f) => f !== d.flag) : [...complementDangers, d.flag]);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        border: active ? '1px solid #dc2626' : '1px solid #cbd5e1',
                        backgroundColor: active ? '#dc2626' : '#f8fafc',
                        color: active ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
              <button className="btn primary" style={{ flex: 1 }} onClick={envoyerComplement} disabled={complementLoading}>
                {complementLoading ? 'Envoi…' : 'Transmettre'}
              </button>
              <button className="btn ghost" onClick={() => setShowComplementModal(false)}>
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Déclenchement SOS */}
      {showConfirmSOSModal && (
        <div className="qr-modal-overlay" style={{ zIndex: 1100 }} onClick={(e) => { if (e.target === e.currentTarget && !loadingSOS) setShowConfirmSOSModal(false); }}>
          <div className="qr-modal-content" style={{ maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(210,16,52,0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <ShieldAlert size={32} />
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>Signaler une urgence</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Votre position géographique sera transmise au centre de supervision LOTISEC pour prise en charge immédiate.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setShowConfirmSOSModal(false)}
                disabled={loadingSOS}
              >
                Annuler
              </button>
              <button
                className="btn danger"
                style={{ flex: 1.2 }}
                onClick={sendSOS}
                disabled={loadingSOS}
              >
                {loadingSOS ? 'Transmission…' : 'Transmettre le SOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Annulation SOS */}
      {showCancelSOSModal && (
        <div className="qr-modal-overlay" style={{ zIndex: 1100 }} onClick={(e) => { if (e.target === e.currentTarget) setShowCancelSOSModal(false); }}>
          <div className="qr-modal-content" style={{ maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>Annuler le signalement SOS</h3>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Confirmez-vous l'annulation de ce signalement d'urgence auprès du centre de supervision LOTISEC ?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn ghost"
                style={{ flex: 1 }}
                onClick={() => setShowCancelSOSModal(false)}
              >
                Conserver l'alerte
              </button>
              <button
                className="btn danger"
                style={{ flex: 1 }}
                onClick={annulerSOS}
              >
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
