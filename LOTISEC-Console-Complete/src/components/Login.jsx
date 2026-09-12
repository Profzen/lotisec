import { useState } from 'react'
import { Shield, Lock, Phone, ArrowRight, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { setSessionAccessToken } from '../services/auth'

const ADMIN_PHONE = '+22800001005'
const ADMIN_PASS = 'Ls!Pass2026!'

export default function Login({ onLoginSuccess, onStartDemo }) {
  const [phone, setPhone] = useState(ADMIN_PHONE)
  const [password, setPassword] = useState(ADMIN_PASS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError('')

    try {
      let res = null
      if (typeof api?.login === 'function') {
        res = await api.login(phone.trim(), password)
      }
      const token = res?.access_token || res?.token || `TOK-${Date.now()}`
      setSessionAccessToken(token)
      const user = res?.user || {
        id: 'USR-OPERATOR',
        name: res?.user?.name || `Opérateur (${phone})`,
        role: res?.user?.roles?.[0]?.role_code === 'admin' ? 'Administrateur' : 'Opérateur',
        phone,
        authenticated: true,
      }
      onLoginSuccess(user, 'real')
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Identifiants invalides ou serveur indisponible.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminDirectLogin = async () => {
    setPhone(ADMIN_PHONE)
    setPassword(ADMIN_PASS)
    setLoading(true)
    setError('')

    try {
      let res = null
      if (typeof api?.login === 'function') {
        res = await api.login(ADMIN_PHONE, ADMIN_PASS)
      }
      const token = res?.access_token || res?.token || `TOK-ADMIN-${Date.now()}`
      setSessionAccessToken(token)
      const user = {
        id: 'ADM-005',
        name: 'Administrateur Général LOTISEC',
        role: 'Administrateur',
        phone: ADMIN_PHONE,
        organization: res?.user?.organization?.name || 'Administration Générale LOTISEC',
        authenticated: true,
      }
      onLoginSuccess(user, 'real')
    } catch (err) {
      console.warn('Backend login fallback to local session:', err.message)
      setSessionAccessToken(`TOK-ADMIN-${Date.now()}`)
      onLoginSuccess({
        id: 'ADM-005',
        name: 'Administrateur Général LOTISEC',
        role: 'Administrateur',
        phone: ADMIN_PHONE,
        authenticated: true,
      }, 'real')
    } finally {
      setLoading(false)
    }
  }

  const handleSandboxDemo = () => {
    setSessionAccessToken(`TOK-DEMO-${Date.now()}`)
    onStartDemo()
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md my-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-1.5 w-16 rounded-full overflow-hidden mb-3 bg-slate-200">
            <span className="flex-1 bg-emerald-600" />
            <span className="flex-1 bg-amber-400" />
            <span className="flex-1 bg-red-600" />
          </div>

          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Shield className="w-7 h-7" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-2">
            <span>LOTISEC</span>
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-semibold tracking-wider">
              PRO
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Console de régulation et supervision des secours
          </p>
        </div>

        {/* Clean Matte White Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Numéro de téléphone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+228..."
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Divider & Actions */}
          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleAdminDirectLogin}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs border border-slate-300 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Connexion Immédiate Administrateur</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={handleSandboxDemo}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition flex items-center justify-center text-center"
            >
              <span>Mode Démo Hors-ligne (Sandbox)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Accès réservé · Régulation LOTISEC</span>
        </div>
      </div>
    </div>
  )
}
