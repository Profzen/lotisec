import React, { useState } from 'react';
import { ChevronLeft, Flame, Car, ShieldAlert, Heart, Info, Phone } from 'lucide-react';

const CONSEILS = [
  {
    id: '1', icon: '🚨', titre: 'Accident de la route',
    categorie: 'Urgence', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80',
    imageCredit: 'Secours routier · Unsplash',
    etapes: [
      'Sécurisez la zone — allumez vos feux de détresse et placez le triangle de signalisation',
      'Appelez le 118 (pompiers) ou le 15 (SAMU) immédiatement',
      'Ne déplacez pas la victime sauf danger immédiat (feu, noyade)',
      'Vérifiez la conscience : parlez-lui fort, tapotez doucement son épaule',
      'Si inconsciente et ne respire pas : commencez la RCP',
      'Couvrez la victime pour éviter l\'hypothermie',
      'Restez avec elle jusqu\'à l\'arrivée des secours',
    ],
    important: 'Ne donnez jamais à boire à une personne accidentée',
  },
  {
    id: '2', icon: '❤️', titre: 'Réanimation cardio-pulmonaire (RCP)',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&q=80',
    imageCredit: 'Premiers secours · Unsplash',
    etapes: [
      'Allongez la victime sur le dos sur une surface dure',
      'Penchez sa tête en arrière pour dégager les voies respiratoires',
      'Vérifiez la respiration pendant 10 secondes maximum',
      'Placez vos mains au centre de la poitrine',
      'Appuyez fort et vite : 30 compressions à 5–6 cm de profondeur',
      'Donnez 2 insufflations (bouche-à-bouche) si vous êtes formé',
      'Continuez le cycle 30 compressions / 2 insufflations jusqu\'aux secours',
    ],
    important: 'Commencez dès que possible — chaque minute compte !',
  },
  {
    id: '3', icon: '🩸', titre: 'Arrêter un saignement',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
    imageCredit: 'Soins médicaux · Unsplash',
    etapes: [
      'Portez des gants si disponibles pour vous protéger',
      'Appuyez fermement sur la plaie avec un tissu propre ou une compresse',
      'Maintenez la pression sans relâcher pendant au moins 10 minutes',
      'Si le sang traverse, ajoutez du tissu par-dessus sans enlever le premier',
      'Élevez le membre blessé au-dessus du niveau du cœur si possible',
      'Ne retirez jamais un objet planté dans la plaie',
      'Appelez le 118 si le saignement est abondant',
    ],
  },
  {
    id: '4', icon: '🏍️', titre: 'Sécurité à moto',
    categorie: 'Prévention', couleur: '#1565D8', couleurBg: '#EAF2FF',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    imageCredit: 'Sécurité moto · Unsplash',
    etapes: [
      'Portez toujours votre casque homologué — il réduit les risques de décès de 40%',
      'Portez des vêtements de protection : gants, veste, bottes',
      'Vérifiez votre moto avant chaque trajet : pneus, freins, éclairage',
      'Respectez les limitations de vitesse — jamais au-dessus de 80 km/h en ville',
      'Restez visible : portez un gilet réfléchissant la nuit',
      'Ne conduisez jamais sous l\'emprise de l\'alcool ou de la fatigue',
      'Maintenez une distance de sécurité d\'au moins 2 secondes',
    ],
    important: 'Le casque sauve des vies — portez-le à chaque trajet',
  },
  {
    id: '5', icon: '🚦', titre: 'Respect du code de la route',
    categorie: 'Prévention', couleur: '#1565D8', couleurBg: '#EAF2FF',
    imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
    imageCredit: 'Code de la route · Unsplash',
    etapes: [
      'Respectez les feux rouges — ne jamais les griller même si la route semble libre',
      'Cédez le passage aux piétons sur les passages cloutés',
      'Limitez votre vitesse : 50 km/h en ville, 90 km/h sur route',
      'Ne téléphonez jamais en conduisant — utilisez le kit mains libres',
      'Utilisez vos clignotants avant chaque changement de direction',
      'Ne doublez jamais dans un virage ou sur une ligne blanche continue',
      'Gardez vos papiers de voiture, assurance et permis à jour',
    ],
    important: 'Un feu rouge grillé peut coûter une vie',
  },
  {
    id: '6', icon: '🌧️', titre: 'Conduite par temps de pluie',
    categorie: 'Prévention', couleur: '#1565D8', couleurBg: '#EAF2FF',
    imageUrl: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80',
    imageCredit: 'Conduite pluie · Unsplash',
    etapes: [
      'Réduisez votre vitesse de 20 à 30% par rapport au temps sec',
      'Augmentez la distance de sécurité — la distance de freinage double sur sol mouillé',
      'Allumez vos feux de croisement même en journée',
      'Évitez les flaques d\'eau — elles peuvent cacher des trous profonds',
      'Ne freinez pas brutalement — freinez progressivement',
      'Vérifiez l\'état de vos essuie-glaces avant la saison des pluies',
      'En cas d\'aquaplaning : lâchez l\'accélérateur sans freiner brusquement',
    ],
  },
  {
    id: '7', icon: '🔥', titre: 'Incendie de véhicule',
    categorie: 'Urgence', couleur: '#FF6B00', couleurBg: '#FFF4EC',
    imageUrl: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=80',
    imageCredit: 'Incendie · Unsplash',
    etapes: [
      'Arrêtez le véhicule immédiatement et coupez le moteur',
      'Faites sortir tous les passagers rapidement',
      'Éloignez-vous d\'au moins 50 mètres du véhicule',
      'N\'ouvrez jamais le capot si vous voyez de la fumée',
      'Appelez le 118 immédiatement',
      'N\'essayez pas d\'éteindre le feu vous-même si les flammes sont importantes',
      'Prévenez les autres conducteurs avec vos feux de détresse',
    ],
    important: 'Ne retournez jamais chercher vos affaires dans un véhicule en feu',
  },
  {
    id: '8', icon: '👶', titre: 'Sécurité des enfants en voiture',
    categorie: 'Prévention', couleur: '#1565D8', couleurBg: '#EAF2FF',
    imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80',
    imageCredit: 'Sécurité enfants · Unsplash',
    etapes: [
      'Utilisez toujours un siège auto adapté au poids et à la taille de l\'enfant',
      'Les enfants de moins de 10 ans voyagent obligatoirement à l\'arrière',
      'Ne placez jamais un siège bébé dos à la route côté airbag actif',
      'Vérifiez que les portières sont bien verrouillées avec le sécurité enfant',
      'Ne laissez jamais un enfant seul dans une voiture, même quelques minutes',
      'Apprenez aux enfants à attacher leur ceinture automatiquement',
      'Expliquez-leur les règles de sécurité routière dès le plus jeune âge',
    ],
  },
  {
    id: '9', icon: '😵', titre: 'Victime inconsciente',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&q=80',
    imageCredit: 'Secours médicaux · Unsplash',
    etapes: [
      'Appelez à l\'aide et demandez à quelqu\'un d\'appeler le 118',
      'Vérifiez sa conscience : parlez fort, tapotez l\'épaule',
      'Si elle ne répond pas, vérifiez sa respiration pendant 10 secondes',
      'Si elle respire : placez-la en Position Latérale de Sécurité (PLS)',
      'Si elle ne respire pas : commencez la RCP immédiatement',
      'Ne donnez rien à boire ni à manger',
      'Surveillez sa respiration jusqu\'à l\'arrivée des secours',
    ],
    important: 'La PLS évite l\'étouffement en cas de vomissements',
  },
];

const FILTRES = [
  { key: 'Tout', label: 'Tout', icon: '📋' },
  { key: 'Urgence', label: 'Urgence', icon: '🚨' },
  { key: 'Premiers secours', label: 'Premiers secours', icon: '🏥' },
  { key: 'Prévention', label: 'Prévention', icon: '🛡️' },
];

export function Conseils() {
  const [categorieActive, setCategorieActive] = useState('Tout');
  const [conseilOuvert, setConseilOuvert] = useState<string | null>(null);

  const conseilsFiltres = categorieActive === 'Tout' 
    ? CONSEILS 
    : CONSEILS.filter(c => c.categorie === categorieActive);

  const statsCategorie = (cat: string) =>
    cat === 'Tout' ? CONSEILS.length : CONSEILS.filter(c => c.categorie === cat).length;

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
              className={`filter-pill ${categorieActive === f.key ? 'active' : ''}`}
              onClick={() => setCategorieActive(f.key)}
            >
              {f.icon} {f.label} 
              <span className="filter-badge">{statsCategorie(f.key)}</span>
            </button>
          ))}
        </div>

        <div className="hopitaux-list">
          
          {/* Header List: Emergency numbers and stats */}
          <div className="lotisec-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
            <div className="conseil-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
            <div style={{ flex: 1, backgroundColor: '#FFEbee', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: 'var(--color-danger)', fontSize: '1.25rem', fontWeight: 'bold' }}>2</div>
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>Urgences</div>
            </div>
            <div style={{ flex: 1, backgroundColor: '#E3F2FD', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#1565C0', fontSize: '1.25rem', fontWeight: 'bold' }}>3</div>
              <div style={{ color: '#1565C0', fontSize: '0.8rem', textAlign: 'center' }}>Premiers sec.</div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: '#2E7D32', fontSize: '1.25rem', fontWeight: 'bold' }}>4</div>
              <div style={{ color: '#2E7D32', fontSize: '0.8rem' }}>Prévention</div>
            </div>
          </div>

          {/* Conseils List */}
          {conseilsFiltres.map((c, index) => {
            const isOuvert = conseilOuvert === c.id;
            return (
              <div key={c.id} style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <div 
                  className="lotisec-card" 
                  style={{ 
                    borderLeft: `4px solid ${c.couleur}`, 
                    padding: '1rem', 
                    cursor: 'pointer',
                    border: isOuvert ? `1.5px solid ${c.couleur}` : '1px solid var(--color-border)',
                    borderLeftWidth: '4px'
                  }}
                  onClick={() => setConseilOuvert(isOuvert ? null : c.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ backgroundColor: c.couleurBg, width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                      {c.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>{c.titre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: c.couleurBg, color: c.couleur, padding: '3px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {c.categorie}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.etapes.length} étapes</span>
                      </div>
                    </div>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: 8, border: `1px solid ${isOuvert ? c.couleur : 'var(--color-border)'}`, 
                      backgroundColor: isOuvert ? c.couleur : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: isOuvert ? 'white' : c.couleur, fontSize: '0.8rem', fontWeight: 'bold'
                    }}>
                      {isOuvert ? '∧' : '∨'}
                    </div>
                  </div>

                  {isOuvert && (
                    <div style={{ marginTop: '1rem' }}>
                      {/* Image */}
                      <div style={{ position: 'relative', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
                        <img src={c.imageUrl} alt={c.titre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${c.couleur}40` }}></div>
                        <div style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.55)', padding: '5px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '0.875rem', fontWeight: 'bold' }}>
                          {c.icon} {c.titre}
                        </div>
                        <div style={{ position: 'absolute', bottom: 6, right: 8, color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem' }}>{c.imageCredit}</div>
                      </div>

                      <div style={{ height: 1, backgroundColor: `${c.couleur}30`, marginBottom: '1rem' }}></div>

                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '0.75rem' }}>À faire étape par étape</div>
                      
                      {c.etapes.map((etape, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                          <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.couleur, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ fontSize: '0.875rem', lineHeight: '20px', color: 'var(--color-text)' }}>{etape}</div>
                        </div>
                      ))}

                      {c.important && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: c.couleurBg, border: `1px solid ${c.couleur}`, padding: '12px', borderRadius: '12px', marginTop: '10px', marginBottom: '12px' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.couleur, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>⚠</div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: c.couleur, lineHeight: '20px' }}>{c.important}</div>
                        </div>
                      )}

                      <button 
                        style={{ width: '100%', backgroundColor: c.couleur, color: 'white', padding: '13px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); window.location.href = 'tel:118'; }}
                      >
                        <Phone size={16} /> Appeler le 118 — Pompiers
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ position: 'absolute', top: -6, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: c.couleur, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 'bold' }}>
                  {index + 1}
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', marginTop: '8px' }}>
            <div style={{ fontSize: '20px' }}>ℹ️</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: '18px' }}>
              Ces conseils sont fournis à titre informatif. En cas d'urgence, appelez toujours les secours professionnels.
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
