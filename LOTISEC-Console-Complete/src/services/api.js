const DEFAULT_API_URL = 'https://lotisec-backend.vercel.app';
const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, '');

let authToken = localStorage.getItem('lotisec_token') || '';

export function setAuthToken(token) {
  authToken = token || '';
  if (token) {
    localStorage.setItem('lotisec_token', token);
  } else {
    localStorage.removeItem('lotisec_token');
  }
}

export function getAuthToken() {
  return authToken || localStorage.getItem('lotisec_token') || '';
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-LOTISEC-Client': 'console_web',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      setAuthToken('');
    }

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail || errJson.message || errorMsg;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[API] Error on ${path}:`, error.message);
    throw error;
  }
}

export const api = {
  // Auth
  login: async (phone, password) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    if (res?.token) {
      setAuthToken(res.token);
    }
    return res;
  },
  getMe: () => request('/auth/me'),
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setAuthToken('');
    }
  },

  // Health
  health: () => request('/health'),

  // Incidents
  getIncidents: () => request('/api/v1/incidents'),
  createIncident: (data) => request('/api/v1/incidents', { method: 'POST', body: JSON.stringify(data) }),
  updateIncidentStatus: (id, status, notes) =>
    request(`/api/v1/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ to_status: status, notes }),
    }),
  assignIncident: (id, { organization_id, response_unit_id, assigned_to }) =>
    request(`/api/v1/incidents/${id}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ organization_id, response_unit_id, assigned_to }),
    }),
  getIncidentTimeline: (id) => request(`/api/v1/incidents/${id}/timeline`),

  // Resources (Ambulances & Pompiers)
  getResources: () => request('/api/v1/resources'),
  updateResourceLocation: (id, { latitude, longitude, heading = 0, speed = 0 }) =>
    request(`/api/v1/resources/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude, heading, speed }),
    }),

  // Facilities & Capacities (Hospitals)
  getFacilities: () => request('/api/v1/facilities'),
  updateCapacities: (facilityId, capacities) =>
    request(`/api/v1/facilities/${facilityId}/capacities`, {
      method: 'PUT',
      body: JSON.stringify(capacities),
    }),

  // Interventions
  getInterventions: () => request('/api/v1/interventions'),
  updateInterventionStatus: (id, status) =>
    request(`/api/v1/interventions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  requestAdmission: (interventionId, { facility_id, triage_level = 'orange', notes = '' }) =>
    request(`/api/v1/interventions/${interventionId}/admissions`, {
      method: 'POST',
      body: JSON.stringify({ facility_id, triage_level, notes }),
    }),

  // Admissions
  getAdmissions: () => request('/api/v1/admissions'),
  updateAdmissionStatus: (id, status, { bed_number = '', rejection_reason = '' } = {}) =>
    request(`/api/v1/admissions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, bed_number, rejection_reason }),
    }),

  // Notifications
  getNotifications: () => request('/api/v1/notifications'),
  markNotificationRead: (id) => request(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),

  // Audit
  getAudit: () => request('/api/v1/audit'),
  getActivityAudit: () => request('/api/v1/activity-audit'),

  // Organization members
  getOrganizationMembers: (orgId) => request(`/api/v1/organizations/${orgId}/members`),
};
