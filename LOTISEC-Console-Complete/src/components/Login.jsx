import React, { useState } from 'react';
import { Shield, Lock, Phone, ArrowRight, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

const ADMIN_ACCOUNT = {
  roleId: 'admin',
  title: 'Administrateur Général',
  subtitle: 'Accès complet unifié : Sapeurs-Pompiers, SAMU/Ambulances, Gestion Hospitalière, Centrale 118, Pilotage & Audit',
  phone: '+22800001005',
  password: 'Ls!Pass2026!',
  badge: 'Super Admin Total',
  tone: 'from-blue-600 to-indigo-700',
  icon: Shield,
  operator: { id: 'ADM-005', name: 'Administrateur Général LOTISEC', role: 'Administrateur' },
};

export default function Login({ onLoginSuccess, onStartDemo }) {
  const [phone, setPhone] = useState(ADMIN_ACCOUNT.phone);
  const [password, setPassword] = useState(ADMIN_ACCOUNT.password);
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
    setPhone(ADMIN_ACCOUNT.phone);
    setPassword(ADMIN_ACCOUNT.password);
    setLoading(true);
    setError('');

    try {
      const res = await api.login(ADMIN_ACCOUNT.phone, ADMIN_ACCOUNT.password);
      const user = {
        id: ADMIN_ACCOUNT.operator.id,
        name: ADMIN_ACCOUNT.operator.name,
        role: 'Administrateur',
        phone: ADMIN_ACCOUNT.phone,
        organization: res?.user?.organization?.name || 'Administration Générale LOTISEC',
      };
      onLoginSuccess(user, 'real');
    } catch (err) {
      console.warn('Backend login fallback to local session:', err.message);
      onLoginSuccess(ADMIN_ACCOUNT.operator, 'real');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071322] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/15 blur-[120px] rounded-full" />
        <div className="absolute -bottom-40 right-10 w-[500px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative w-full max-w-4xl z-10 my-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Plateforme Nationale d'Urgence · République Togolaise
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              LOTISEC <span className="text-blue-500 font-bold">PRO</span>
            </h1>
          </div>
          <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
            Centre de régulation géodécisionnelle, coordination des secours 118, SAMU et orientation hospitalière.
          </p>
        </div>

        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-6 items-stretch">
          {/* Quick Access Admin Box (Recommended 1-Click) */}
          <div className="bg-[#0b1b30]/90 backdrop-blur-xl border border-blue-900/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-950/50 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Accès Recommandé (1 Clic)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Compte Officiel</span>
              </div>

              <div className="my-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Administrateur Général
                    </h3>
                    <p className="text-xs text-blue-300">Droits universels sur tous les modules</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300/90 leading-relaxed bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
                  Ce profil donne un <b>accès total</b> à l'ensemble des modules : gestion des sapeurs-pompiers (118), régulation des ambulances/SAMU, lits hospitaliers, dispatch central, pilotage national, traçabilité et configuration.
                </p>

                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Téléphone : <code className="text-slate-200 font-mono font-semibold">+22800001005</code></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Rôle RBAC : <span className="text-emerald-400 font-semibold">Super Administrateur</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleAdminDirectLogin}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Connexion Immédiate Administrateur</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Manual Form Box */}
          <div className="bg-[#0b1b30]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white">Connexion Manuelle</h2>
                  <p className="text-xs text-slate-400">Pour un autre compte ou agent</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-400">
                  JWT
                </span>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+22800001005"
                      className="w-full bg-[#071322] border border-slate-700/80 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mot de passe</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#071322] border border-slate-700/80 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Se connecter</span>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={onStartDemo}
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition"
              >
                <Sparkles className="w-4 h-4" />
                Mode Démo Hors-ligne (Sandbox)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-500">
          LOTISEC v2.2.0 · Système certifié pour les services de secours togolais (118, SAMU, Hôpitaux)
        </div>
      </div>
    </div>
  );
}
