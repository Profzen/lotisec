const API_URL = import.meta.env.VITE_API_URL || 'https://lotisec-backend.vercel.app'
const DEMO_FALLBACK = String(import.meta.env.VITE_ENABLE_DEMO_FALLBACK ?? 'true') === 'true'

async function request(path, options = {}) {
  try {
    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('lotisec-token')) : null
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}) 
    }
    const response = await fetch(`${API_URL}${path}`, {
      headers,
      ...options,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (!DEMO_FALLBACK) throw error
    return null
  }
}

export const api = {
  login: async (phone, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || `Échec de connexion (HTTP ${res.status})`)
    }
    return await res.json()
  },
  dashboard: () => request('/api/v1/dashboard'),
  alerts: () => request('/api/v1/incidents'),
  incidents: () => request('/api/v1/incidents'),
  validateAlert: (id) => request(`/api/v1/incidents/${id}/status`, { method:'PATCH', body:JSON.stringify({ status:'validated' }) }),
  interventions: () => request('/api/v1/interventions'),
  ambulances: () => request('/api/v1/ambulances'),
  hospitals: () => request('/api/v1/hospitals'),
  routes: (interventionId) => request(`/api/v1/routing/compare?interventionId=${encodeURIComponent(interventionId)}`),
  hospitalOrientation: (interventionId) => request(`/api/v1/hospitals/orientation?interventionId=${encodeURIComponent(interventionId)}`),
  fogStatus: () => request('/api/v1/fog/status'),
}
