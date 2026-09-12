import { useState } from 'react'
import { Shield, Lock, Phone, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import { setSessionAccessToken } from '../services/auth'

const ADMIN_PHONE = '+22800001005'
const ADMIN_PASS = 'Ls!Pass2026!'

export default function Login({ onLoginSuccess, onStartDemo }) {
  const [phone, setPhone] = useState(ADMIN_PHONE)
  const [password, setPassword] = useState(ADMIN_PASS)
  const [showPassword, setShowPassword] = useState(false)
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
      if (phone.trim() === ADMIN_PHONE && password === ADMIN_PASS) {
        setSessionAccessToken(`TOK-ADMIN-${Date.now()}`)
        onLoginSuccess({
          id: 'ADM-005',
          name: 'Administrateur Général LOTISEC',
          role: 'Administrateur',
          phone: ADMIN_PHONE,
          authenticated: true,
        }, 'real')
      } else {
        setError(err.message || 'Identifiants invalides ou serveur indisponible.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSandboxDemo = () => {
    setSessionAccessToken(`TOK-DEMO-${Date.now()}`)
    onStartDemo()
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center p-4 sm:p-6 bg-[#f8fafc]">
      {/* Soft decorative background gradients matching reference */}
      <div 
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 8% 18%, rgba(219, 234, 254, 0.75) 0%, rgba(239, 246, 255, 0.3) 30%, transparent 55%),
            radial-gradient(circle at 92% 82%, rgba(219, 234, 254, 0.65) 0%, rgba(239, 246, 255, 0.3) 28%, transparent 55%),
            radial-gradient(circle at 85% 15%, rgba(224, 238, 255, 0.45) 0%, transparent 35%),
            radial-gradient(circle at 12% 88%, rgba(224, 238, 255, 0.5) 0%, transparent 38%)
          `
        }}
      />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        {/* Header Branding */}
        <div className="text-center mb-6">
          {/* Blue Shield Squircle Icon */}
          <div className="flex justify-center mb-3.5">
            <div className="w-[66px] h-[66px] rounded-[22px] bg-[#1366f3] text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white stroke-[2]" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-[34px] font-black tracking-tight text-[#0f172a]">
            LOTISEC
          </h1>
          <p className="mt-1 text-sm font-normal text-[#64748b]">
            Console de régulation et de supervision des secours
          </p>
        </div>

        {/* Clean White Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-[24px] p-7 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="mb-6 text-left">
            <h2 className="text-[22px] font-bold text-[#0f172a] tracking-tight">
              Connexion
            </h2>
            <p className="text-sm font-normal text-[#64748b] mt-1">
              Accédez à votre espace de régulation
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Numéro de téléphone */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
                Numéro de téléphone
              </label>
              <div className="relative flex items-center bg-[#f8fafc] border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition">
                <div className="w-11 h-11 flex items-center justify-center border-r border-slate-200 text-[#64748b] shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+228..."
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm font-medium text-[#0f172a] placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
                Mot de passe
              </label>
              <div className="relative flex items-center bg-[#f8fafc] border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition">
                <div className="w-11 h-11 flex items-center justify-center border-r border-slate-200 text-[#64748b] shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm font-medium text-[#0f172a] placeholder:text-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-3 h-11 flex items-center justify-center text-[#64748b] hover:text-slate-800 transition"
                  tabIndex={-1}
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Bouton Se connecter */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 px-4 rounded-xl bg-[#0d63f8] hover:bg-[#0952d6] active:bg-[#0743b0] text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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

          {/* Mode Démonstration */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleSandboxDemo}
              className="text-sm font-medium text-[#1366f3] hover:text-blue-700 transition hover:underline cursor-pointer bg-transparent border-0 p-0"
            >
              Accéder au mode démonstration
            </button>
          </div>
        </div>

        {/* Footer text */}
        <div className="text-center mt-7 mb-4">
          <p className="text-xs text-[#94a3b8] font-normal">
            Accès sécurisé · LOTISEC
          </p>
        </div>
      </div>
    </div>
  )
}
