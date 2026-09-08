const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const DEMO_FALLBACK = String(import.meta.env.VITE_ENABLE_DEMO_FALLBACK ?? 'true') === 'true'

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
  dashboard: () => request('/dashboard'),
  alerts: () => request('/alerts'),
  validateAlert: (id) => request(`/alerts/${id}/validate`, { method:'POST' }),
  interventions: () => request('/interventions'),
  ambulances: () => request('/ambulances'),
  hospitals: () => request('/hospitals'),
  routes: (interventionId) => request(`/routing/compare?interventionId=${encodeURIComponent(interventionId)}`),
  hospitalOrientation: (interventionId) => request(`/hospitals/orientation?interventionId=${encodeURIComponent(interventionId)}`),
  fogStatus: () => request('/fog/status'),
}
