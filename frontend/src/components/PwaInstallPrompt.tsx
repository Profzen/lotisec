import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update UI to notify the user they can add to home screen
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If it's iOS and not running in standalone mode, we might want to show a custom prompt
    if (isIosDevice && !window.matchMedia('(display-mode: standalone)').matches) {
      // Pour éviter de spammer sur iOS, on peut utiliser le localStorage
      const hasSeenPrompt = localStorage.getItem('pwa_ios_prompt_seen');
      if (!hasSeenPrompt) {
        setShowPrompt(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, throw it away
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    if (isIos) {
      localStorage.setItem('pwa_ios_prompt_seen', 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      <button 
        onClick={handleClose}
        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
      >
        <X size={20} />
      </button>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <img src="/logo-118.png" alt="118 Logo" style={{ width: '60px', height: '60px', borderRadius: '12px' }} />
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: 'var(--color-primary)', fontSize: '1.2rem' }}>Installer 118</h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            Accédez plus rapidement aux secours depuis votre écran d'accueil.
          </p>
        </div>
      </div>

      {isIos && !deferredPrompt ? (
        <div style={{ backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', color: '#333' }}>
          Pour installer l'application sur votre iPhone :<br/>
          Appuyez sur le bouton <b>Partager</b> en bas de l'écran, puis sur <b>Sur l'écran d'accueil</b>.
        </div>
      ) : (
        <button 
          onClick={handleInstallClick}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Download size={18} />
          Installer l'application
        </button>
      )}
    </div>
  );
}
