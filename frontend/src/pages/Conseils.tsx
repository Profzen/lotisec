import React, { useState } from 'react';
import { ChevronLeft, Flame, Car, Heart, ShieldAlert, Phone } from 'lucide-react';

const FILTRES = [
  { key: 'tous', label: 'Tout', count: 9 },
  { key: 'urgence', label: 'Urgence', count: 2 },
  { key: 'secours', label: 'Premiers sec.', count: 3 },
  { key: 'prevention', label: 'Prévention', count: 4 },
];

export function Conseils() {
  const [filtreActif, setFiltreActif] = useState('tous');

  return (
    <>
      <div className="top-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <ChevronLeft color="white" size={24} onClick={() => window.history.back()} style={{ cursor: 'pointer' }} />
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Conseils de sécurité</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Les gestes qui sauvent · Prévention routière</div>
          </div>
        </div>
      </div>

      <div className="white-sheet" style={{ padding: 0 }}>
        {/* Filtres */}
        <div className="filters-container">
          {FILTRES.map(f => (
            <button 
              key={f.key} 
              className={`filter-pill ${filtreActif === f.key ? 'active' : ''}`}
              onClick={() => setFiltreActif(f.key)}
            >
              {f.key === 'tous' ? '📋 ' : f.key === 'urgence' ? '🚨 ' : f.key === 'secours' ? '🩹 ' : '🛡️ '}
              {f.label} <span className="filter-badge">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="hopitaux-list">
          {/* Card Numéros d'urgence */}
          <div className="lotisec-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
            <div className="conseil-header" style={{ marginBottom: '1rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-danger)' }}></div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>Numéros d'urgence</div>
            </div>
            <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Composez immédiatement en cas d'accident</p>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, backgroundColor: '#D21034', color: 'white', borderRadius: '12px', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.location.href = 'tel:118'}>
                <Flame size={20} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>118</div>
                <div style={{ fontSize: '0.7rem' }}>Pompiers</div>
              </div>
              
              <div style={{ flex: 1, backgroundColor: '#1565C0', color: 'white', borderRadius: '12px', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.location.href = 'tel:15'}>
                <Car size={20} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>15</div>
                <div style={{ fontSize: '0.7rem' }}>SAMU</div>
              </div>

              <div style={{ flex: 1, backgroundColor: '#424242', color: 'white', borderRadius: '12px', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.location.href = 'tel:117'}>
                <ShieldAlert size={20} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>117</div>
                <div style={{ fontSize: '0.7rem' }}>Police</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
            <div style={{ flex: 1, backgroundColor: '#FFEbee', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: 'var(--color-danger)', fontSize: '1.25rem', fontWeight: 'bold' }}>2</div>
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>Urgences</div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#E3F2FD', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#1565C0', fontSize: '1.25rem', fontWeight: 'bold' }}>3</div>
              <div style={{ color: '#1565C0', fontSize: '0.8rem' }}>Premiers sec.</div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#2E7D32', fontSize: '1.25rem', fontWeight: 'bold' }}>4</div>
              <div style={{ color: '#2E7D32', fontSize: '0.8rem' }}>Prévention</div>
            </div>
          </div>

          <div className="lotisec-card" style={{ borderLeft: '4px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer' }}>
            <div style={{ backgroundColor: '#FFEbee', padding: '0.75rem', borderRadius: '12px' }}>
              <ShieldAlert color="var(--color-danger)" size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Accident de la route</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span className="badge-urgence" style={{ backgroundColor: '#FFEbee', color: 'var(--color-danger)' }}>Urgence</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>7 étapes</span>
              </div>
            </div>
            <div style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>∨</div>
          </div>

          <div className="lotisec-card" style={{ borderLeft: '4px solid #D21034', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer' }}>
            <div style={{ backgroundColor: '#FFEbee', padding: '0.75rem', borderRadius: '12px' }}>
              <Heart color="var(--color-danger)" size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>Réanimation cardio-pulmonaire (RCP)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span className="badge-urgence" style={{ backgroundColor: '#FFEbee', color: 'var(--color-danger)' }}>Premiers secours</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>7 étapes</span>
              </div>
            </div>
            <div style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>∨</div>
          </div>
        </div>
      </div>
    </>
  );
}
