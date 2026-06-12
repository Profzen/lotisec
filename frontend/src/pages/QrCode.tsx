import React, { useMemo } from 'react';
import { ChevronLeft, Share2, HelpCircle, FileDown, CheckCircle } from 'lucide-react';
import QRCode from 'react-qr-code';

export function QrCode() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? JSON.parse(raw) : null;
  }, []);

  const qrToken = user?.qr_token;
  const qrUrl = qrToken ? `https://qr-web-dbap.vercel.app/scan/${qrToken}` : '';

  const handleDownload = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share && qrUrl) {
      navigator.share({
        title: 'Mon Code QR LOTISEC',
        text: 'Voici mon code QR d\'urgence médicale LOTISEC.',
        url: qrUrl,
      }).catch(err => console.error(err));
    } else {
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

      <div className="white-sheet" style={{ alignItems: 'center', paddingTop: '3rem' }}>
        
        {qrToken ? (
          <div className="printable-qr">
            <div className="qr-container">
              <QRCode value={qrUrl} size={200} />
            </div>
          </div>
        ) : (
          <div className="qr-container" style={{ width: '264px', height: '264px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={64} color="var(--color-border)" />
          </div>
        )}

        <button className="btn primary" onClick={handleDownload} style={{ marginBottom: '1rem' }}>
          <FileDown size={20} /> TÉLÉCHARGER MON CODE QR
        </button>

        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginBottom: '2rem' }}>
          <button className="btn ghost" style={{ flex: 1, backgroundColor: 'white' }} onClick={handleShare}>
            <Share2 size={18} /> Partager le lien
          </button>
          <button className="btn ghost" style={{ flex: 1, backgroundColor: 'white', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
            <HelpCircle size={18} /> Aide
          </button>
        </div>

        <div style={{ backgroundColor: '#E8F5E9', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', color: '#1B5E20' }}>
          <CheckCircle size={24} color="#2E7D32" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
            En cas d'accident, une simple lecture de ce code permettra aux secouristes d'avoir accès à vos informations d'urgence.
          </div>
        </div>

      </div>
    </>
  );
}
