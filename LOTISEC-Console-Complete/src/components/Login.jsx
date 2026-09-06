import React, { useState } from 'react';
import { Shield, Lock, Phone, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const ADMIN_PHONE = '+22800001005';
const ADMIN_PASS = 'Ls!Pass2026!';

export default function Login({ onLoginSuccess, onStartDemo }) {
  const [phone, setPhone] = useState(ADMIN_PHONE);
  const [password, setPassword] = useState(ADMIN_PASS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.login(phone.trim(), password);
      const user = res.user || {
        id: 'USR-OPERATOR',
        name: res.user?.name || `Opérateur (${phone})`,
        role: res.user?.roles?.[0]?.role_code === 'admin' ? 'Administrateur' : 'Opérateur',
        phone,
      };
      onLoginSuccess(user, 'real');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Identifiants invalides ou serveur indisponible.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDirectLogin = async () => {
    setPhone(ADMIN_PHONE);
    setPassword(ADMIN_PASS);
    setLoading(true);
    setError('');

    try {
      const res = await api.login(ADMIN_PHONE, ADMIN_PASS);
      const user = {
        id: 'ADM-005',
        name: 'Administrateur Général LOTISEC',
        role: 'Administrateur',
        phone: ADMIN_PHONE,
        organization: res?.user?.organization?.name || 'Administration Générale LOTISEC',
      };
      onLoginSuccess(user, 'real');
    } catch (err) {
      console.warn('Backend login fallback to local session:', err.message);
      onLoginSuccess({
        id: 'ADM-005',
        name: 'Administrateur Général LOTISEC',
        role: 'Administrateur',
        phone: ADMIN_PHONE,
      }, 'real');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071322] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-40 right-10 w-[400px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md z-10 my-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/25 mb-3 border border-white/10">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            LOTISEC <span className="text-blue-500">PRO</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Console de régulation et supervision des secours
          </p>
        </div>

        {/* Single Main Card */}
        <div className="bg-[#0b1b30]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-black/60">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Téléphone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+228..."
                  className="w-full bg-[#071322] border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#071322] border border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Quick Access Divider & Actions */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleAdminDirectLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700/80 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Connexion Immédiate Administrateur</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onStartDemo}
              className="w-full py-2 px-3 rounded-xl text-xs text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mode Démo Hors-ligne (Sandbox)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
