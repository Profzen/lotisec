import React, { useState, useEffect } from 'react';
import { ChevronLeft, Share2, HelpCircle, FileDown, CheckCircle, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import { api } from '../api/client';

export function QrCode() {
  const [user, setUser] = useState<any>(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user?.qr_token) {
        try {
          setLoading(true);
          const { data } = await api.get('/auth/me');
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('lotisec_user', JSON.stringify(data.user));
          }
        } catch (e) {
          console.warn('Erreur récupération /auth/me sur Web QrCode:', e);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUser();
  }, []);

  const qrToken = user?.qr_token;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://lotisec-frontend.vercel.app';
  const qrUrl = qrToken ? `${baseUrl}/scan/${qrToken}` : '';

  const handleDownload = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share && qrUrl) {
      navigator.share({
        title: 'Mon Code QR LOTISEC',
        text: 'Voici ma fiche d\'urgence médicale officielle LOTISEC.',
        url: qrUrl,
      }).catch(err => console.error(err));
    } else if (qrUrl) {
      navigator.clipboard.writeText(qrUrl);
      alert('Lien copié dans le presse-papier !');
    }
  };

  return (
    <>
      <div className="top-header" style={{ flexDirection: 'column', alignItems: 'center', paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
          <ChevronLeft color="white" size={24} onClick={() => window.history.back()} style={{ cursor: 'pointer', position: 'absolute', left: '1.5rem' }} />
        </div>
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Mon Code QR</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.25rem' }}>Télécharger, imprimer et plastifier avant usage</div>
        </div>
      </div>

      <div className="white-sheet" style={{ alignItems: 'center', paddingTop: '2.5rem' }}>
        
        {qrToken ? (
          <div className="printable-qr" style={{ marginBottom: '1.5rem' }}>
            <div className="qr-container" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <QRCode value={qrUrl} size={220} fgColor="#071A2E" />
              <div style={{ marginTop: '1rem', fontWeight: 'bold', color: 'var(--color-primary)', letterSpacing: '1.5px', fontSize: '1.1rem' }}>
                ID : {qrToken}
              </div>
            </div>
          </div>
        ) : (
          <div className="qr-container" style={{ width: '264px', height: '264px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '1.5rem', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
            {loading ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Génération du code QR...</div>
            ) : (
              <>
                <HelpCircle size={48} color="var(--color-border)" />
                <div style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Code QR non disponible</div>
              </>
            )}
          </div>
        )}

        <button className="btn primary" onClick={handleDownload} disabled={!qrToken} style={{ marginBottom: '1rem', width: '100%', maxWidth: '340px' }}>
          <FileDown size={20} /> TÉLÉCHARGER MON CODE QR
        </button>

        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '340px', marginBottom: '2rem' }}>
          <button className="btn ghost" style={{ flex: 1, backgroundColor: 'white' }} onClick={handleShare} disabled={!qrToken}>
            <Share2 size={18} /> Partager le lien
          </button>
          <button className="btn ghost" style={{ flex: 1, backgroundColor: 'white', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} onClick={() => alert("En cas d'accident, ce code QR permet aux secours d'accéder instantanément à vos données médicales et d'alerter vos proches.")}>
            <HelpCircle size={18} /> Aide
          </button>
        </div>

        <div style={{ backgroundColor: '#EAF2FF', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--color-primary)', maxWidth: '340px', border: '1px solid #C8D9F2' }}>
          <ShieldCheck size={28} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
            En cas d'accident, une simple lecture de ce code permettra aux secouristes d'avoir accès à vos informations d'urgence.
          </div>
        </div>

      </div>
    </>
  );
}
