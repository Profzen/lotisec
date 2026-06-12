import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { ShieldAlert, Activity, Phone, Car } from 'lucide-react';

export function ScanResult() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [accessCode, setAccessCode] = useState('');
  const [unlockedData, setUnlockedData] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const handleUnlock = async () => {
    if (accessCode.trim().length < 4) {
      toast.error("Le code d'accréditation est trop court.");
      return;
    }

    setVerifying(true);
    try {
      // Pour une vraie application, cela appellerait le backend
      const response = await api.post('/scan/verify', {
        token: token,
        pin: accessCode.trim().toUpperCase(),
        authority_type: 'emergency_unit',
      });
      setUnlockedData(response.data);
    } catch (e: any) {
      if (e.response && e.response.status === 403) {
        toast.error("Accès Refusé. Code invalide.");
      } else {
        toast.error("Erreur de liaison au serveur Lotisec.");
      }
      setAccessCode('');
    } finally {
      setVerifying(false);
    }
  };

  if (!unlockedData) {
    return (
      <div className="app-content" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ backgroundColor: 'var(--color-primary)', padding: '3rem 1rem', textAlign: 'center', color: 'white' }}>
          <ShieldAlert size={60} style={{ marginBottom: '1rem' }} />
          <h1 style={{ color: 'white', margin: 0 }}>Lotisec</h1>
          <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>Fiche d'urgence scannée</div>
        </div>

        <div style={{ padding: '1.5rem', flex: 1 }}>
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.5rem', color: '#dc2626', fontWeight: 'bold' }}>
            ⚠️ En cas d'urgence, appelez le 118
          </div>

          <div className="lotisec-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>🔐 Accès professionnel</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Saisissez votre code d'unité pour accéder aux données vitales complètes.<br />
              Ex : QARO387963 · KAMA985463
            </p>

            <input 
              type="text" 
              placeholder="CODE ACCÈS" 
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              maxLength={12}
              style={{ textAlign: 'center', letterSpacing: '3px', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
            />

            <button 
              className="btn primary" 
              onClick={handleUnlock} 
              disabled={verifying}
              style={{ width: '100%' }}
            >
              {verifying ? 'Vérification...' : 'Déverrouiller'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { identity, medical, vehicle, emergency_contacts, audit } = unlockedData;

  return (
    <div className="app-content" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <div style={{ backgroundColor: '#0f172a', padding: '3rem 1rem 2rem', textAlign: 'center', color: 'white' }}>
        <Activity size={50} color="#e11d48" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'white', margin: 0 }}>Données vitales</h2>
        <div style={{ backgroundColor: '#4ade80', color: '#0f172a', display: 'inline-block', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '1rem' }}>
          ✅ {audit?.authority || 'Professionnel'}
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
