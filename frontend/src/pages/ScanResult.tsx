import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { ShieldAlert, Activity, Phone, Car } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export function ScanResult() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [unlockedData, setUnlockedData] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [pin, setPin] = useState('');
  const [sessionAccess,setSessionAccess]=useState(false);

  const handleUnlock = async (credential=pin.trim()) => {
    setVerifying(true);
    try {
      const response = await api.post('/scan/verify', {
        token: token,
        pin: credential,
        authority_type: 'emergency_unit',
      });
      setUnlockedData(response.data);
    } catch (e: any) {
      if (e.response && e.response.status === 403) {
        toast.error("PIN ou code institutionnel invalide.");
      } else {
        toast.error("Erreur de liaison au serveur LOTISEC.");
      }
    } finally {
      setVerifying(false);
    }
  };

  useEffect(()=>{
    try{
      const user=JSON.parse(localStorage.getItem('lotisec_user')||'{}');
      const professional=(user.roles||[]).some((role:string)=>['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent'].includes(role));
      const owner=user.qr_token===token;
      if(professional||owner){setSessionAccess(true);void handleUnlock('');}
    }catch{/* Le scan public reste disponible avec le PIN. */}
  },[token]);

  if (!unlockedData) {
    return (
      <div className="app-content scan-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="scan-theme"><ThemeToggle /></div>
        <div style={{ backgroundColor: 'var(--color-primary)', padding: '3rem 1rem', textAlign: 'center', color: 'white' }}>
          <ShieldAlert size={60} style={{ marginBottom: '1rem' }} />
          <h1 style={{ color: 'white', margin: 0 }}>LOTISEC</h1>
          <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Fiche d'urgence scannée</div>
        </div>

        <div style={{ padding: '1.5rem', flex: 1 }}>
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.5rem', color: '#dc2626', fontWeight: 'bold' }}>
            En cas d'urgence, appelez le 118
          </div>

          <div className="lotisec-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Accès professionnel authentifié</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              {sessionAccess?'Vérification de votre session autorisée…':'Saisissez le PIN personnel communiqué par le citoyen ou un code d’urgence temporaire de votre organisation.'}
            </p>

            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN citoyen ou code d’urgence"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              type="password"
              style={{ width: '100%', marginBottom: '1rem' }}
            />

            <button 
              className="btn primary" 
              onClick={()=>handleUnlock()}
              disabled={verifying || !pin.trim()}
              style={{ width: '100%' }}
            >
              {verifying ? 'Vérification...' : 'Ouvrir la fiche'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { identity, medical, vehicle, emergency_contacts, audit } = unlockedData;

  return (
    <div className="app-content scan-page" style={{ minHeight: '100vh' }}>
      <div className="scan-theme"><ThemeToggle /></div>
      <div style={{ backgroundColor: '#0f172a', padding: '3rem 1rem 2rem', textAlign: 'center', color: 'white' }}>
        <Activity size={50} color="#e11d48" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'white', margin: 0 }}>Données vitales</h2>
        <div style={{ backgroundColor: '#4ade80', color: '#0f172a', display: 'inline-block', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '1rem' }}>
          Accès vérifié · {audit?.authority || 'Professionnel'}
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        
        {/* Identité */}
        <div className="lotisec-card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '1rem' }}>👤 IDENTITÉ</div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem', color: '#0f172a' }}>{identity?.first_name} {identity?.last_name}</h2>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>{identity?.gender} • Né(e) le {identity?.birth_date} • {identity?.nationality}</div>
        </div>

        {/* Médical */}
        <div className="lotisec-card" style={{ marginBottom: '1rem', borderLeft: '5px solid #e11d48' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '1rem' }}>🏥 DONNÉES MÉDICALES</div>
          
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#fff1f2', border: '1px solid #fca5a5', borderRadius: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.65rem', color: '#e11d48', fontWeight: 'bold', letterSpacing: '1px' }}>GROUPE SANGUIN</span>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#e11d48', lineHeight: 1 }}>{medical?.blood_type || 'NC'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(medical?.height || medical?.weight) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Taille / Poids</span>
                <span style={{ fontWeight: 'bold' }}>{medical?.height || 'NC'} cm · {medical?.weight || 'NC'} kg</span>
              </div>
            )}
            {medical?.allergies && medical.allergies !== 'Aucune' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Allergies</span>
                <span style={{ fontWeight: 'bold', color: '#e11d48', fontSize: '0.875rem' }}>{medical.allergies}</span>
              </div>
            )}
            {medical?.conditions && medical.conditions !== 'Aucune' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Maladies chroniques</span>
                <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.875rem' }}>{medical.conditions}</span>
              </div>
            )}
            {medical?.medications && medical.medications !== 'Aucun' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Médicaments</span>
                <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.875rem' }}>{medical.medications}</span>
              </div>
            )}
            {medical?.disabilities && medical.disabilities !== 'Aucun' && (
              <div className="scan-info-row"><span>Handicap / besoins spécifiques</span><strong>{medical.disabilities}</strong></div>
            )}
            {(medical?.doctor_name || medical?.doctor_phone) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Médecin traitant</span>
                <span style={{ fontWeight: 'bold' }}>{[medical.doctor_name, medical.doctor_phone].filter(Boolean).join(' · ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contacts */}
        <div className="lotisec-card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '1rem' }}>📞 CONTACTS D'URGENCE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {emergency_contacts?.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {c.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{c.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.relation || 'Contact'} • {c.phone}</div>
                </div>
                <button 
                  style={{ backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '10px', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => window.open(`tel:${c.phone}`)}
                >
                  <Phone size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Véhicule */}
        {vehicle?.has_vehicle && (
          <div className="lotisec-card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '1rem' }}>🚗 VÉHICULE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Type</span>
                <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '0.875rem' }}>{vehicle.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Immatriculation</span>
                <span style={{ fontWeight: '900', color: '#0f172a', fontSize: '1rem' }}>{vehicle.plate}</span>
              </div>
              {(vehicle.brand || vehicle.model) && <div className="scan-info-row"><span>Marque / modèle</span><strong>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</strong></div>}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: '2rem 0', fontStyle: 'italic' }}>
          Session sécurisée • Unité {audit?.authority} • Token {audit?.token}
        </div>

        <button className="btn" style={{ backgroundColor: '#334155', color: 'white' }} onClick={() => navigate('/')}>
          Quitter le profil
        </button>

      </div>
    </div>
  );
}
