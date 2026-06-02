import { FormEvent, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, authHeaders } from './api/client';

type UserData = {
  id: string;
  phone: string;
  qr_token?: string;
};

type Hospital = {
  nom: string;
  distance_km?: number;
  telephone?: string;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-wrap">
      <header className="hero">
        <p className="eyebrow">LOTISEC</p>
        <h1>Urgence routiere, version web citoyenne</h1>
        <p className="subtitle">
          Authentification, SOS geolocalise, QR personnel, conseils et hopitaux proches.
        </p>
      </header>
      {children}
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  return (
    <Shell>
      <div className="card deck">
        <button className="btn primary" onClick={() => navigate('/login')}>Connexion</button>
        <button className="btn ghost" onClick={() => navigate('/register')}>Inscription</button>
      </div>
    </Shell>
  );
}

function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      localStorage.setItem('lotisec_token', data.token);
      localStorage.setItem('lotisec_user', JSON.stringify(data.user));
      navigate('/home');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Echec de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Connexion</h2>
        <label>Telephone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228..." required />
        <label>Mot de passe</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={loading}>{loading ? 'Connexion...' : 'Entrer'}</button>
      </form>
    </Shell>
  );
}

function Register() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', { phone, password });
      localStorage.setItem('lotisec_token', data.token);
      localStorage.setItem('lotisec_user', JSON.stringify(data.user));
      navigate('/home');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Echec d inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <form className="card form" onSubmit={onSubmit}>
        <h2>Inscription rapide</h2>
        <label>Telephone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228..." required />
        <label>Mot de passe</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={loading}>{loading ? 'Creation...' : 'Creer mon compte'}</button>
      </form>
    </Shell>
  );
}

function Home() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    const raw = localStorage.getItem('lotisec_user');
    return raw ? (JSON.parse(raw) as UserData) : null;
  }, []);
  const [message, setMessage] = useState('Pret pour SOS.');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingSOS, setLoadingSOS] = useState(false);

  const logout = () => {
    localStorage.removeItem('lotisec_token');
    localStorage.removeItem('lotisec_user');
    navigate('/');
  };

  const detectHospitals = async (lat: number, lng: number) => {
    const { data } = await api.get('/geo/hopital-proche', { params: { lat, lng } });
    setHospitals(Array.isArray(data) ? data : []);
  };

  const sendSOS = async () => {
    if (!navigator.geolocation) {
      setMessage('Geolocalisation non supportee.');
      return;
    }

    setLoadingSOS(true);
    setMessage('Detection GPS en cours...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          await Promise.allSettled([
            api.post('/accidents', {
              latitude,
              longitude,
              user_id: user?.id,
              qr_token: user?.qr_token,
              vehicle_type: 'moto'
            }),
            api.post('/alertes', {
              latitude,
              longitude,
              user_id: user?.id,
              qr_token: user?.qr_token,
              prenom: 'Utilisateur',
              nom: 'LOTISEC',
              groupe_sanguin: '?',
              adresse: 'Position GPS web'
            })
          ]);

          await detectHospitals(latitude, longitude);
          setMessage('SOS envoye avec succes.');
        } catch {
          setMessage('Echec envoi SOS.');
        } finally {
          setLoadingSOS(false);
        }
      },
      () => {
        setLoadingSOS(false);
        setMessage('Position GPS refusee ou indisponible.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveQuickProfile = async () => {
    try {
      await api.post(
        '/profil/',
        {
          first_name: 'Utilisateur',
          last_name: 'Web',
          blood_type: 'NC',
          emergency_contacts: [{ name: 'Contact SOS', phone: '+22800000000', relation: 'Proche' }]
        },
        { headers: authHeaders() }
      );
      setMessage('Profil rapide synchronise.');
    } catch {
      setMessage('Impossible de synchroniser le profil.');
    }
  };

  return (
    <div className="app-shell">
      <aside className="left-panel card">
        <h2>Mon espace</h2>
        <p><strong>ID:</strong> {user?.id || 'N/A'}</p>
        <p><strong>Telephone:</strong> {user?.phone || 'N/A'}</p>
        <p><strong>QR Token:</strong> {user?.qr_token || 'N/A'}</p>
        <button className="btn ghost" onClick={saveQuickProfile}>Sync profil rapide</button>
        <button className="btn ghost" onClick={logout}>Deconnexion</button>
      </aside>

      <main className="right-panel">
        <section className="card sos-card">
          <h2>Bouton SOS</h2>
          <p>{message}</p>
          <button className="btn danger" onClick={sendSOS} disabled={loadingSOS}>
            {loadingSOS ? 'Envoi SOS...' : 'Declencher SOS'}
          </button>
        </section>

        <section className="card">
          <h2>Hopitaux recommandes</h2>
          {hospitals.length === 0 ? <p>Declenche un SOS pour obtenir une recommendation.</p> : null}
          <ul className="list">
            {hospitals.map((h, i) => (
              <li key={`${h.nom}-${i}`}>
                <span>{h.nom}</span>
                <span>{h.distance_km ? `${h.distance_km} km` : '-'}</span>
                <span>{h.telephone || '-'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Conseils securite</h2>
          <ul className="tips">
            <li>Porte toujours le casque et garde tes papiers a jour.</li>
            <li>Partage ton QR avec tes proches et colle-le sur ton vehicule.</li>
            <li>En cas d accident, priorite a l alerte et au positionnement GPS.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('lotisec_token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/home"
        element={
          <Protected>
            <Home />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
