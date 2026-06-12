import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { Search, MapPin, Phone, Navigation, AlertCircle, ChevronLeft } from 'lucide-react';

type TypeEtablissement = 'hopital' | 'clinique' | 'dispensaire' | 'cs';

interface Hopital {
  id: string;
  name: string;
  type: TypeEtablissement;
  address: string;
  phone?: string;
  distance: number;
  minutes: number;
  latitude: number;
  longitude: number;
  urgences: boolean;
}

const TYPE_CONFIG: Record<TypeEtablissement, { label: string; icon: string; color: string; bg: string }> = {
  hopital: { label: 'Hôpital', icon: '🏥', color: '#1565C0', bg: '#E3F2FD' },
  clinique: { label: 'Clinique', icon: '🏪', color: '#2E7D32', bg: '#E8F5E9' },
  dispensaire: { label: 'Dispensaire', icon: '💊', color: '#6A1B9A', bg: '#F3E5F5' },
  cs: { label: 'Centre de santé', icon: '➕', color: '#E65100', bg: '#FBE9E7' },
};

const FILTRES = [
  { key: 'tous', label: 'Tous' },
  { key: 'hopital', label: 'Hôpitaux' },
  { key: 'clinique', label: 'Cliniques' },
  { key: 'dispensaire', label: 'Dispensaires' },
  { key: 'cs', label: 'Centres de santé' },
  { key: 'urgences', label: 'Urgences 24h' },
];

const estimerMinutes = (km: number): number => Math.round((km / 30) * 60);

export function Hopitaux() {
  const [hopitaux, setHopitaux] = useState<Hopital[]>([]);
  const [filtreActif, setFiltreActif] = useState<string>('tous');
  const [recherche, setRecherche] = useState('');
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const chargerPosition = useCallback(() => {
    setLoading(true);
    setErreur(null);
    if (!navigator.geolocation) {
      setErreur('Géolocalisation non supportée par votre navigateur.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        fetchHopitaux(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setErreur('Permission de localisation refusée.');
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const fetchHopitaux = async (lat: number, lon: number) => {
    try {
      const res = await api.get(`/geo/hopital-proche?lat=${lat}&lng=${lon}`);
      const liste: Hopital[] = res.data.map((h: any) => ({
        ...h,
        distance: Number(h.distance_km),
        minutes: estimerMinutes(Number(h.distance_km))
      }));
      setHopitaux(liste);
    } catch (err) {
      setErreur("Erreur lors de la récupération des hôpitaux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerPosition();
  }, [chargerPosition]);

  const hopitauxFiltres = hopitaux.filter(h => {
    const matchR = recherche === '' || h.name.toLowerCase().includes(recherche.toLowerCase()) || h.address.toLowerCase().includes(recherche.toLowerCase());
    const matchF = filtreActif === 'tous' || (filtreActif === 'urgences' && h.urgences) || h.type === filtreActif;
    return matchR && matchF;
  });

  const compterFiltre = (key: string) => {
    if (key === 'tous') return hopitaux.length;
    if (key === 'urgences') return hopitaux.filter(h => h.urgences).length;
    return hopitaux.filter(h => h.type === key).length;
  };

  const ouvrirItineraire = (h: Hopital) => {
    const dest = `${h.latitude},${h.longitude}`;
    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
    const url = origin 
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank');
  };

  // Le chargement est géré via un overlay désormais

  if (erreur) {
    return (
      <div className="center-state">
        <AlertCircle size={48} className="text-danger mb-4" />
        <p className="text-center">{erreur}</p>
        <button className="btn primary mt-4" onClick={chargerPosition}>Réessayer</button>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p className="mt-4" style={{color: 'var(--color-primary)', fontWeight: 'bold'}}>Chargement...</p>
        </div>
      )}
      <div className="top-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <ChevronLeft color="white" size={24} onClick={() => window.history.back()} style={{ cursor: 'pointer' }} />
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Centres de santé</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{hopitauxFiltres.length} centre(s) trouvé(s)</div>
          </div>
        </div>
        
        <div className="search-bar">
          <Search size={18} color="rgba(255,255,255,0.7)" />
          <input 
            type="text" 
            placeholder="Rechercher un centre de santé..." 
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
      </div>

      <div className="white-sheet" style={{ padding: 0 }}>
        {/* Filtres */}
        <div className="filters-container">
          {FILTRES.map(f => {
            const count = compterFiltre(f.key);
            const actif = filtreActif === f.key;
            return (
              <button 
                key={f.key} 
                className={`filter-pill ${actif ? 'active' : ''}`}
                onClick={() => setFiltreActif(f.key)}
              >
                {f.label} {count > 0 && <span className="filter-badge">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Liste */}
        <div className="hopitaux-list">
          {hopitauxFiltres.length === 0 ? (
            <div className="center-state" style={{ paddingTop: '2rem' }}>
              <div style={{ fontSize: '3rem' }}>🏥</div>
              <h3 className="mt-4">Aucun résultat</h3>
              <p className="text-secondary text-center">Essayez un autre filtre ou terme de recherche</p>
            </div>
          ) : (
            hopitauxFiltres.map((item, index) => {
              const config = TYPE_CONFIG[item.type];
              return (
                <div key={item.id} className="lotisec-card hopital-card">
                  <div className="hopital-rank" style={{ backgroundColor: index === 0 ? 'var(--color-primary)' : '#f3f4f6', color: index === 0 ? 'white' : 'var(--color-text-secondary)' }}>
                    #{index + 1}
                  </div>
                  
                  <div className="hopital-header">
                    <div className="hopital-icon" style={{ backgroundColor: config.bg }}>{config.icon}</div>
                    <div className="hopital-info">
                      <div className="hopital-title-row">
                        <div className="hopital-name">{item.name}</div>
                        {item.urgences && <div className="badge-urgence">24h</div>}
                      </div>
                      <div className="badge-type" style={{ backgroundColor: config.bg, color: config.color }}>{config.label}</div>
                    </div>
                  </div>

                  <div className="hopital-address">
                    <MapPin size={14} color="var(--color-text-secondary)" />
                    <span>{item.address}</span>
                  </div>

                  <div className="hopital-metrics">
                    <div className="metric">
                      <div className="metric-val">{item.distance} km</div>
                      <div className="metric-lbl">distance</div>
                    </div>
                    <div className="divider-vertical"></div>
                    <div className="metric">
                      <div className="metric-val" style={{ color: item.minutes <= 5 ? '#2E7D32' : item.minutes <= 15 ? '#F57F17' : 'var(--color-danger)' }}>{item.minutes} min</div>
                      <div className="metric-lbl">en voiture</div>
                    </div>
                    <div className="divider-vertical"></div>
                    <div className="metric">
                      <div className="metric-val" style={{ color: '#2E7D32' }}>{Math.round(item.minutes / 2)} min</div>
                      <div className="metric-lbl">à moto</div>
                    </div>
                  </div>

                  <div className="hopital-actions">
                    {item.phone && (
                      <button className="btn action-call" onClick={() => window.location.href = `tel:${item.phone}`}>
                        <Phone size={16} /> Appeler
                      </button>
                    )}
                    <button className="btn action-maps" style={{ flex: item.phone ? 2 : 1 }} onClick={() => ouvrirItineraire(item)}>
                      <Navigation size={16} /> Itinéraire
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
