import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Shield, ArrowRight, UserPlus, LogIn } from 'lucide-react';

export function Landing() {
  const navigate = useNavigate();
  return (
    <div className="app-container justify-center items-center" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="lotisec-card text-center" style={{ maxWidth: '400px', width: '90%' }}>
        <img src="/Lotisec.png" alt="Lotisec Logo" style={{ width: '120px', margin: '0 auto 1rem' }} />
        <h1 style={{ color: 'var(--color-primary)' }}>LOTISEC</h1>
        <p className="text-secondary mb-4">Urgence routière, Secours et Réservation Zemidjan au Togo.</p>
        <div className="flex flex-col gap-4">
          <button className="btn primary" onClick={() => navigate('/login')}>
            <LogIn size={20} />
            Connexion
          </button>
          <button className="btn ghost" onClick={() => navigate('/register')}>
            <UserPlus size={20} />
            Créer un compte
          </button>
        </div>
      </div>
    </div>
  );
}

export function Login() {
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
      setError(err?.response?.data?.detail || 'Échec de connexion. Vérifiez vos identifiants.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container justify-center items-center">
      <form className="lotisec-card" style={{ maxWidth: '400px', width: '90%' }} onSubmit={onSubmit}>
        <div className="text-center mb-4">
          <Shield size={48} className="text-primary mx-auto" />
          <h2 className="mt-4">Connexion</h2>
        </div>
        
        <div>
          <label>Numéro de téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228..." required />
        </div>
        
        <div>
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: 'rgba(210, 16, 52, 0.1)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
        
        <button className="btn primary mt-4" disabled={loading}>
          {loading ? 'Connexion en cours...' : 'Entrer'}
          {!loading && <ArrowRight size={20} />}
        </button>
        
        <button type="button" className="btn ghost mt-4" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </form>
    </div>
  );
}

export function Register() {
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
      setError(err?.response?.data?.detail || 'Échec d\'inscription. Numéro déjà utilisé ?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container justify-center items-center">
      <form className="lotisec-card" style={{ maxWidth: '400px', width: '90%' }} onSubmit={onSubmit}>
        <div className="text-center mb-4">
          <Shield size={48} className="text-primary mx-auto" />
          <h2 className="mt-4">Inscription</h2>
        </div>
        
        <div>
          <label>Numéro de téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228..." required />
        </div>
        
        <div>
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 caractères" required minLength={6} />
        </div>
        
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: 'rgba(210, 16, 52, 0.1)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
        
        <button className="btn primary mt-4" disabled={loading}>
          {loading ? 'Création en cours...' : 'Créer mon compte'}
        </button>
        
        <button type="button" className="btn ghost mt-4" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </form>
    </div>
  );
}
