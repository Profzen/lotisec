const STORAGE_KEY = "lotisec:incident-feed:v3";
const EVENT_KEY = "lotisec:mobile-event";
const THEME_KEY = "lotisec:theme";
const AUTH_KEY = "lotisec:console-session:v1";
const OFFLINE_CACHE_KEY = "lotisec:offline-cache:v1";
const API_BASE = (window.LOTISEC_API_URL || localStorage.getItem("lotisec:api-url") || "https://lotisec-backend.vercel.app").replace(/\/$/, "");
const API_URL = `${API_BASE}/api/v1/incidents`;
const channel = "BroadcastChannel" in window ? new BroadcastChannel("lotisec-incidents") : null;

let session = (() => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch { return null; } })();
const CONSOLE_ROLES = new Set(["admin","supervisor","dispatcher","firefighter","ambulance_driver","hospital_manager","hospital_agent"]);

// Mode de vue actif pour les administrateurs ('global', 'firefighter', 'hospital')
let currentAdminView = 'global';
let isNetworkOffline = !navigator.onLine;

function apiFetch(path, options = {}) {
  if (isNetworkOffline) {
    return handleOfflineApi(path, options);
  }
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers, cache: options.cache || "no-store" })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem(AUTH_KEY); session = null; showLogin(); }
      if (!response.ok) throw new Error(body.detail || body.error || `Erreur API ${response.status}`);
      return body;
    })
    .catch((err) => {
      if (!navigator.onLine || err.message.includes('Failed to fetch')) {
        setOfflineMode(true);
        return handleOfflineApi(path, options);
      }
      throw err;
    });
}

function handleOfflineApi(path, options) {
  console.log('[Fog Local Node] Traitement hors-ligne local:', path);
  if (path.startsWith('/api/v1/incidents') && options.method === 'POST') {
    const data = JSON.parse(options.body || '{}');
    const localIncident = { ...data, id: `LOC-${Date.now().toString().slice(-6)}`, created_at: new Date().toISOString(), status: 'new', offline_created: true };
    const cached = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || '[]');
    cached.unshift(localIncident);
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cached));
    toast('Traitement Fog Local', 'Alerte enregistrée localement (hors-ligne).');
    return Promise.resolve({ incident: localIncident });
  }
  if (path.startsWith('/api/v1/incidents')) return Promise.resolve({ incidents: state.incidents || [] });
  if (path.startsWith('/api/v1/facilities')) return Promise.resolve({ facilities: hospitals || [] });
  if (path.startsWith('/api/v1/resources')) return Promise.resolve({ resources: ambulances || [] });
  if (path.startsWith('/api/v1/interventions')) return Promise.resolve({ interventions: state.interventions || [] });
  if (path.startsWith('/api/v1/admissions')) return Promise.resolve({ admissions: state.admissions || [] });
  return Promise.resolve({});
}

function setOfflineMode(offline) {
  isNetworkOffline = offline;
  const pill = document.querySelector('[data-connection-mode]');
  const syncLabel = document.querySelector('[data-last-sync]');
  if (offline) {
    if (pill) pill.textContent = 'FOG LOCAL (HORS-LIGNE)';
    if (syncLabel) syncLabel.textContent = 'Résilience active FOG-LOMÉ-01';
  } else {
    if (pill) pill.textContent = 'CONNEXION RÉTABLIE';
    if (syncLabel) syncLabel.textContent = 'Synchronisation cloud';
  }
}

window.addEventListener('online', async () => {
  setOfflineMode(false);
  toast('Réseau rétabli', 'Synchronisation avec le cloud LOTISEC en cours…');
  await syncOfflineCache();
  await loadOperationalData();
  renderCurrentModule();
});
window.addEventListener('offline', () => {
  setOfflineMode(true);
  toast('Coupure réseau détectée', 'Bascule automatique sur le nœud Fog local.');
});

async function syncOfflineCache() {
  const cached = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || '[]');
  if (!cached.length) return;
  for (const item of cached) {
    try {
      await apiFetch('/api/v1/incidents', { method: 'POST', body: JSON.stringify(item) });
    } catch (e) {
      console.warn('Erreur sync cache:', e);
    }
  }
  localStorage.removeItem(OFFLINE_CACHE_KEY);
  toast('Synchronisation terminée', `${cached.length} incident(s) synchronisé(s).`);
}

function showLogin(message = "") {
  let overlay = document.querySelector("[data-console-login]");
  if (!overlay) {
    overlay = document.createElement("div"); overlay.dataset.consoleLogin = ""; overlay.className = "console-login";
    overlay.innerHTML = `<form class="console-login__card"><img src="assets/logo-lotisec.png" alt="LOTISEC"><small>ACCÈS INSTITUTIONNEL SÉCURISÉ</small><h1>Console opérationnelle</h1><p data-login-message>Connectez-vous avec votre compte professionnel.</p><label>Téléphone<input name="phone" autocomplete="username" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Se connecter</button><em data-login-error></em></form>`;
    document.body.appendChild(overlay);
    overlay.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const error = overlay.querySelector("[data-login-error]"); error.textContent = "Connexion…";
      try {
        const result = await apiFetch("/auth/login", { method:"POST", body:JSON.stringify({phone:form.get("phone"),password:form.get("password")}) });
        const roles = result.user?.roles || [];
        if (!roles.some((role) => CONSOLE_ROLES.has(role))) throw new Error("Ce compte n’est pas autorisé à accéder à la console.");
        session = { token:result.token, realtimeToken:result.realtime_token, user:result.user };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        overlay.remove();
        applyRbac();
        startRealtime();
        await loadOperationalData();
        await pollMobileApi();
      } catch (err) { error.textContent = err.message || "Connexion impossible"; }
    });
  }
  overlay.querySelector("[data-login-message]").textContent = message || "Connectez-vous avec votre compte professionnel.";
}

function applyRbac() {
  if (!session?.user) return showLogin();
  const roles = session.user.roles || [];
  const permissions = session.user.permissions || [];
  const isAdmin = roles.includes("admin");
  const isHospital = roles.some(r => ["hospital_manager", "hospital_agent"].includes(r));
  const isFirefighter = roles.some(r => ["firefighter", "ambulance_driver", "dispatcher", "supervisor"].includes(r));

  // Afficher / masquer le sélecteur de vue Admin
  const adminSwitcher = document.querySelector("[data-admin-view-container]");
  if (adminSwitcher) {
    adminSwitcher.hidden = !isAdmin;
  }

  // Déterminer la vue active
  let activeRolePerspective = 'global';
  if (isAdmin) {
    activeRolePerspective = currentAdminView;
  } else if (isHospital) {
    activeRolePerspective = 'hospital';
  } else {
    activeRolePerspective = 'firefighter';
  }

  // Adapter l'affichage de la sidebar selon la perspective métier
  const allowedModules = new Set();
  const navOps = document.querySelector('[data-nav-group="operations"]');
  const navHosp = document.querySelector('[data-nav-group="hospital"]');
  const navPilot = document.querySelector('[data-nav-group="pilotage"]');

  if (activeRolePerspective === 'hospital') {
    if (navOps) navOps.hidden = true;
    if (navHosp) navHosp.hidden = false;
    if (navPilot) navPilot.hidden = !isAdmin;
    ["Capacités & Lits", "Patients Admis", "Équipe de garde", "Notifications"].forEach(x => allowedModules.add(x));
    if (isAdmin) ["Statistiques", "Paramètres"].forEach(x => allowedModules.add(x));
  } else if (activeRolePerspective === 'firefighter') {
    if (navOps) navOps.hidden = false;
    if (navHosp) navHosp.hidden = true;
    if (navPilot) navPilot.hidden = !isAdmin;
    ["Tableau de bord", "Incidents", "Carte en direct", "Interventions", "Ambulances", "Hôpitaux", "Notifications"].forEach(x => allowedModules.add(x));
  } else {
    // Vue Globale Admin
    if (navOps) navOps.hidden = false;
    if (navHosp) navHosp.hidden = false;
    if (navPilot) navPilot.hidden = false;
    document.querySelectorAll("[data-module]").forEach(el => allowedModules.add(el.dataset.module));
  }

  document.querySelectorAll("[data-module]").forEach((el) => {
    el.hidden = !allowedModules.has(el.dataset.module);
  });

  // Mettre à jour l'en-tête de l'opérateur
  const card = document.querySelector(".operator-card span:nth-child(2)");
  if (card) {
    card.innerHTML = `<small>${escapeHtml(session.user.organization?.name || "LOTISEC TOGO")}</small><strong>${escapeHtml(session.user.first_name ? `${session.user.first_name} ${session.user.last_name||''}` : session.user.phone)}</strong><em><i></i> ${escapeHtml(roles.join(" · "))}</em><button class="logout-btn" type="button" style="background:none;border:none;color:#F87171;font-size:0.7rem;padding:0;margin-top:4px;cursor:pointer;text-align:left;display:block;font-weight:600;">Se déconnecter</button>`;
    card.querySelector(".logout-btn")?.addEventListener("click", () => {
      localStorage.removeItem(AUTH_KEY);
      session = null;
      location.reload();
    });
  }

  // Redirection automatique sur la page d'accueil métier si nécessaire
  if (activeRolePerspective === 'hospital' && (state.currentModule === 'Incidents' || state.currentModule === 'Carte en direct')) {
    switchModule('Capacités & Lits');
  }
}

function canPermission(permission) {
  const permissions = session?.user?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}

// Données réelles des hôpitaux du Togo (chargées par défaut)
const hospitals = [
  { id: "HSP-01", name: "CHU Sylvanus Olympio (Tokoin)", beds: 14, occupancy: 78, distance: 1.8, eta: 4, specialty: "Traumatologie, Réanimation, Urgences 24h", lat: 6.1374, lng: 1.2122, phone: "+228 22 21 25 01", address: "Boulevard du 13 Janvier, Lomé", services: ["Urgences 24h", "Traumatologie", "Réanimation", "Chirurgie", "Scanner"] },
  { id: "HSP-02", name: "CHU Campus Lomé", beds: 18, occupancy: 65, distance: 3.6, eta: 7, specialty: "Urgences polyvalentes, Soins intensifs", lat: 6.1756, lng: 1.2137, phone: "+228 22 25 47 01", address: "Campus universitaire, Lomé", services: ["Urgences", "Médecine interne", "Pédiatrie", "Laboratoire"] },
  { id: "HSP-03", name: "Hôpital Dogta-Lafiè", beds: 22, occupancy: 52, distance: 6.8, eta: 12, specialty: "Urgences, Imagerie avancée, Réanimation", lat: 6.2105, lng: 1.1854, phone: "+228 22 53 70 00", address: "Agoè-Nyivé, Lomé", services: ["Urgences", "Chirurgie", "Imagerie", "Réanimation"] },
  { id: "HSP-04", name: "Hôpital de Bè", beds: 8, occupancy: 85, distance: 4.1, eta: 8, specialty: "Urgences & Soins de proximité", lat: 6.1322, lng: 1.2402, phone: "+228 22 21 16 41", address: "Quartier Bè, Lomé", services: ["Accueil d'urgence", "Soins généraux", "Maternité"] },
  { id: "HSP-05", name: "Polyclinique Saint-Joseph", beds: 11, occupancy: 60, distance: 5.2, eta: 10, specialty: "Clinique médico-chirurgicale", lat: 6.1558, lng: 1.2295, phone: "+228 22 26 72 24", address: "Hédzranawoé, Lomé", services: ["Urgences", "Chirurgie", "Cardiologie"] }
];

const ambulances = [
  { id: "AMB-01", name: "Sapeurs-Pompiers Lomé (118)", number: "118", crew: 4, distance: 2.1, eta: 5, status: "Disponible", lat: 6.1418, lng: 1.2184 },
  { id: "AMB-02", name: "Secours Abalo", number: "8880", crew: 3, distance: 2.4, eta: 6, status: "En mission", lat: 6.1761, lng: 1.2058 },
  { id: "AMB-03", name: "Togo Assistance (SAMU)", number: "8200", crew: 2, distance: 3.8, eta: 9, status: "Disponible", lat: 6.1645, lng: 1.2311 },
  { id: "AMB-04", name: "Ambulance Dogta-Lafiè", number: "+228 22 53 70 00", crew: 2, distance: 7.2, eta: 14, status: "Disponible", lat: 6.2023, lng: 1.1854 }
];

let operationalMaps = [];

const state = {
  incidents: loadIncidents(),
  filter: "all",
  search: "",
  selectedId: null,
  currentModule: "Incidents",
  paused: false,
  queuedEvents: [],
  latestId: null,
  apiCursor: 0,
  notifications: [],
  interventions: [],
  admissions: [],
  adminUsers: [],
  organizations: [],
  zemApplications: [],
  auditLogs: [],
  responders: [],
  accidentGeojson: { features: [] },
  accidentStats: null,
  organizationMembers: [],
  hospitalCapacities: {
    urgences: 12,
    reanimation: 4,
    chirurgie: 6,
    traumatologie: 5
  },
  admittedPatients: [
    { id: 'ADM-2026-001', name: 'Kouassi Mensah', age: 34, blood_type: 'O+', allergies: 'Pénicilline', incident_type: 'Collision moto', arrival_time: '12h40', status: 'En soins intensifs', emergency_contact: '+228 90 12 34 56 (Épouse)' },
    { id: 'ADM-2026-002', name: 'Afiwa Lawson', age: 28, blood_type: 'A+', allergies: 'Aucune connue', incident_type: 'Accident voie publique', arrival_time: '13h15', status: 'Stabilisée', emergency_contact: '+228 91 88 44 22 (Père)' }
  ],
  mission: {
    incidentId: "INC-2026-001",
    ambulanceId: "AMB-01",
    hospitalId: "HSP-01",
    progress: 25,
    phase: "En route",
    totalDistance: 3.2,
    speed: 48,
    routeBlocked: false,
    follow: true,
    startedAt: Date.now()
  }
};

const elements = {
  list: document.querySelector("[data-incident-list]"),
  empty: document.querySelector("[data-empty-state]"),
  detail: document.querySelector("[data-detail-drawer]"),
  detailContent: document.querySelector("[data-detail-content]"),
  manualModal: document.querySelector("[data-manual-modal]"),
  userModal: document.querySelector("[data-user-modal]"),
  grantRoleModal: document.querySelector("[data-grant-role-modal]"),
  zemModal: document.querySelector("[data-zem-modal]"),
  manualForm: document.querySelector("[data-manual-form]"),
  userForm: document.querySelector("[data-user-form]"),
  grantRoleForm: document.querySelector("[data-grant-role-form]"),
  zemForm: document.querySelector("[data-zem-form]"),
  banner: document.querySelector("[data-incoming-banner]"),
  bannerCopy: document.querySelector("[data-incoming-copy]"),
  map: document.querySelector("[data-live-map]"),
  dynamicPage: document.querySelector("[data-dynamic-page]"),
  incidentsPage: document.querySelector('[data-page="incidents"]'),
  topbarTitle: document.querySelector("[data-topbar-title]")
};

function loadIncidents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveIncidents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.incidents));
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (s) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
}
function setText(selector, val) {
  document.querySelectorAll(selector).forEach(el => { el.textContent = val != null ? val : "—"; });
}
function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}

function renderIncidents() {
  if (!elements.list) return;
  const filtered = state.incidents.filter((item) => {
    if (state.filter === "mobile" && item.source !== "mobile") return false;
    if (state.filter === "manual" && item.source !== "manual" && item.source !== "operator") return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      return (item.id || "").toLowerCase().includes(q) || (item.type || "").toLowerCase().includes(q) || (item.place || "").toLowerCase().includes(q);
    }
    return true;
  });

  elements.empty.hidden = filtered.length > 0;
  elements.list.innerHTML = filtered.map((incident) => `
    <article class="incident-row" data-severity="${escapeHtml(incident.severity)}" data-source="${escapeHtml(incident.source)}">
      <button class="incident-main" type="button" data-incident-id="${incident.id}">
        <span class="severity-dot"></span>
        <div class="incident-summary">
          <div class="incident-meta">
            <span class="source-badge">${escapeHtml(incident.source === 'mobile' ? 'SOS Mobile' : 'Opérateur')}</span>
            <time>${formatTime(incident.createdAt || incident.created_at)}</time>
          </div>
          <strong>${escapeHtml(incident.type)}</strong>
          <small>${escapeHtml(incident.place || "Position GPS reçue")}</small>
        </div>
        <div class="incident-data">
          <span><small>Victimes</small><strong>${incident.victims || 1}</strong></span>
          <span><small>Score</small><strong>${incident.score || 85}</strong></span>
        </div>
        <div class="priority-block">
          <small>Statut</small>
          <em class="status-badge status-${incident.status}">${escapeHtml(incident.status === 'new' ? 'À traiter' : incident.status === 'validated' ? 'Validé' : incident.status)}</em>
        </div>
        <span class="row-arrow">›</span>
      </button>
    </article>
  `).join("");

  elements.list.querySelectorAll("[data-incident-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.incidentId));
  });
  updateCounters();
}

function updateCounters() {
  const fresh = state.incidents.filter((item) => item.status === "new");
  const mobile = state.incidents.filter((item) => item.source === "mobile");
  setText("[data-metric-new]", fresh.length);
  setText("[data-metric-mobile]", mobile.length);
  setText("[data-metric-validated]", state.incidents.filter((i) => i.status === "completed" || i.status === "validated").length);
  setText("[data-metric-active-missions]", state.interventions.filter((i) => !["completed","cancelled"].includes(i.status)).length || (state.mission ? 1 : 0));
  setText("[data-filter-all]", state.incidents.length);
  setText("[data-filter-mobile]", mobile.length);
  setText("[data-filter-manual]", state.incidents.filter((i) => i.source === "manual" || i.source === "operator").length);
  setText("[data-nav-incident-count]", fresh.length);
  setText("[data-notification-count]", state.notifications.filter(n => n.unread).length);
  setText("[data-nav-notification-count]", state.notifications.filter(n => n.unread).length);
}

function updateMap(incident) {
  state.selectedId = incident.id;
  setText("[data-map-title]", incident.place || `${incident.type} · position GPS`);
  setText("[data-map-lat]", Number(incident.lat || incident.latitude || 6.137).toFixed(5));
  setText("[data-map-lng]", Number(incident.lng || incident.longitude || 1.212).toFixed(5));
  setText("[data-map-accuracy]", `± ${incident.accuracy || 8} m`);
  setText("[data-fog-score]", `${incident.score || 85}/100`);
  setText("[data-fog-recommended-unit]", "Sapeurs-Pompiers 118");
  const lat = incident.lat || incident.latitude || 6.137;
  const lng = incident.lng || incident.longitude || 1.212;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=15&output=embed`;
  if (elements.map && elements.map.dataset.current !== incident.id) {
    elements.map.src = src;
    elements.map.dataset.current = incident.id;
  }
}

function openDetail(id) {
  const incident = state.incidents.find((item) => item.id === id);
  if (!incident) return;
  updateMap(incident);
  const actionLabel = incident.status === "new" ? "Valider & Dispatcher les Secours" : incident.status === "validated" ? "Affecter une ambulance" : "Ouvrir le suivi";
  const actionName = incident.status === "new" ? "validate" : incident.status === "validated" ? "assign" : "track";

  elements.detailContent.innerHTML = `
    <header class="detail-hero">
      <span class="detail-source">${escapeHtml(incident.source === 'mobile' ? 'SOS Mobile' : 'Opérateur')} · Réception temps réel</span>
      <h2>${escapeHtml(incident.type)}</h2>
      <p>📍 ${escapeHtml(incident.place || "Position GPS certifiée")}</p>
      <div class="detail-id"><span>ID: ${escapeHtml(incident.id)}</span><span>${formatTime(incident.createdAt || incident.created_at)}</span></div>
    </header>
    <section class="detail-section">
      <h3>Données du signalement</h3>
      <div class="detail-grid">
        <div class="detail-stat"><small>Victimes</small><strong>${incident.victims || 1}</strong></div>
        <div class="detail-stat"><small>Véhicules</small><strong>${incident.vehicles || 1}</strong></div>
        <div class="detail-stat"><small>Gravité</small><strong>${escapeHtml(incident.severity || 'high').toUpperCase()}</strong></div>
        <div class="detail-stat"><small>Secours Recommandé</small><strong>Sapeurs-Pompiers (118)</strong></div>
      </div>
    </section>
    <section class="detail-section">
      <h3>Orientation & Hôpital Recommandé</h3>
      <div class="compact-list">
        <span><strong>${escapeHtml(hospitals[0]?.name || 'CHU Sylvanus Olympio')}</strong><em>${hospitals[0]?.beds || 14} places d'urgences</em></span>
      </div>
      <p style="margin-top:10px;font-size:0.75rem;color:#8FA3B8;">${escapeHtml(incident.description || "Aucune observation supplémentaire.")}</p>
    </section>
    <div class="drawer-actions">
      <button class="button button-danger" type="button" data-detail-action="reject">Classer</button>
      <button class="button button-primary" type="button" data-detail-action="${actionName}">${actionLabel}</button>
    </div>`;

  elements.detailContent.querySelectorAll("[data-detail-action]").forEach((button) => {
    button.addEventListener("click", () => handleDetailAction(incident.id, button.dataset.detailAction));
  });
  elements.detail.showModal();
}

function handleDetailAction(id, action) {
  const incident = state.incidents.find((item) => item.id === id);
  if (!incident) return;
  if (action === "reject") {
    incident.status = "rejected";
    toast("Signalement classé", "L'incident a été archivé.");
  } else if (action === "validate" || action === "assign") {
    incident.status = "validated";
    state.mission = {
      incidentId: incident.id,
      ambulanceId: "AMB-01",
      hospitalId: "HSP-01",
      progress: 5,
      phase: "En route",
      totalDistance: 2.4,
      speed: 45,
      routeBlocked: false,
      follow: true,
      startedAt: Date.now()
    };
    toast("Secours engagés", "Sapeurs-Pompiers (118) affectés. Trajet en cours.");
  }
  saveIncidents();
  renderIncidents();
  elements.detail.close();
}

function ingestIncident(incident) {
  if (!incident?.id || state.incidents.some((item) => item.id === incident.id)) return;
  state.incidents.unshift(incident);
  state.latestId = incident.id;
  saveIncidents();
  renderIncidents();
  showIncoming(incident);
}

function showIncoming(incident) {
  if (elements.banner) {
    elements.banner.hidden = false;
    elements.bannerCopy.textContent = `${incident.type} · ${incident.place || "Position GPS"} · ${incident.victims || 1} victime(s)`;
    toast("Nouvelle alerte SOS", `${incident.type} · Dispatching automatique activé.`);
    window.setTimeout(() => { if (elements.banner) elements.banner.hidden = true; }, 10000);
  }
}

// ----------------- MODULE RENDERERS ----------------- //

function metricCard(label, val, note, tone = "blue") {
  return `<article class="module-metric"><small>${label}</small><strong>${val}</strong><span>${note}</span></article>`;
}
function moduleHeader(kicker, title, desc, actions = "") {
  return `<section class="module-heading"><div><span class="eyebrow"><i></i>${kicker}</span><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></section>`;
}
function moduleTop(header, metrics = "") {
  return `<div class="module-sticky">${header}${metrics}</div>`;
}

function renderDashboard() {
  const active = state.incidents.filter((i) => i.status !== "rejected");
  const totalBeds = hospitals.reduce((sum, h) => sum + h.beds, 0);
  return `
    ${moduleTop(moduleHeader("Vue d'ensemble", "Tableau de Bord Opérationnel", "Coordination des secours routiers et régulation médicale."), `
      <section class="module-metrics">
        ${metricCard("Alertes actives", active.length, "Signalements en cours", "red")}
        ${metricCard("Ambulances disponibles", ambulances.filter(a => a.status === "Disponible").length, `Sur ${ambulances.length} unités`, "blue")}
        ${metricCard("Places d'urgence", totalBeds, "Réseau hospitalier Lomé", "green")}
        ${metricCard("Nœud Fog", "FOG-LOMÉ-01", "Résilience active", "purple")}
      </section>
    `)}
    <section class="module-grid">
      <article class="module-card">
        <header><div><small>FILE D'URGENCE</small><h2>Dernières alertes</h2></div><button class="button button-secondary" data-action="go-module" data-target="Incidents">Voir tout</button></header>
        <div class="compact-list">
          ${state.incidents.slice(0, 4).map(inc => `<button data-action="open-incident" data-id="${inc.id}"><span><strong>${escapeHtml(inc.type)}</strong><small style="color:#8FA3B8;display:block;">${escapeHtml(inc.place || 'GPS')}</small></span><em>${inc.status}</em></button>`).join('') || '<p style="color:#8FA3B8;">Aucune alerte récente.</p>'}
        </div>
      </article>
      <article class="module-card">
        <header><div><small>DISPATCHING SECOURS</small><h2>Moyens engagés</h2></div><button class="button button-secondary" data-action="go-module" data-target="Carte en direct">Carte ↗</button></header>
        <div class="compact-list">
          ${ambulances.map(amb => `<span><strong>${escapeHtml(amb.name)}</strong><em style="color:${amb.status==='Disponible'?'#4ADE80':'#FBBF24'}">${amb.status}</em></span>`).join('')}
        </div>
      </article>
    </section>
  `;
}

function renderHospitalCapacities() {
  const caps = state.hospitalCapacities;
  return `
    ${moduleTop(moduleHeader("Centre Hospitalier", "Gestion des Capacités & Lits d'Urgences", "Mise à jour en temps réel des places d'accueil pour la régulation des secours."), `
      <section class="module-metrics">
        ${metricCard("Places d'urgence", caps.urgences, "Accueil immédiat", "green")}
        ${metricCard("Lits Réanimation", caps.reanimation, "Soins intensifs", "red")}
        ${metricCard("Blocs Chirurgie", caps.chirurgie, "Interventions prêtes", "blue")}
        ${metricCard("Traumatologie", caps.traumatologie, "Accidents de la route", "orange")}
      </section>
    `)}
    <section class="module-card">
      <header><div><small>AJUSTEMENT IMMÉDIAT</small><h2>Modifier le nombre de lits disponibles</h2></div></header>
      <p style="color:#8FA3B8;font-size:0.8rem;margin-top:0;">Cliquez sur + ou - pour synchroniser instantanément les capacités avec les régulateurs du 118 et les ambulanciers.</p>
      <div class="capacity-editor-grid">
        <div class="capacity-editor-box">
          <strong>Urgences Générales 24h/24</strong>
          <small>Patients instables ou nécessitant surveillance</small>
          <div class="capacity-stepper">
            <button data-action="adjust-bed" data-service="urgences" data-delta="-1">-</button>
            <span id="cap-urgences">${caps.urgences}</span>
            <button data-action="adjust-bed" data-service="urgences" data-delta="1">+</button>
          </div>
        </div>
        <div class="capacity-editor-box">
          <strong>Lits de Réanimation</strong>
          <small>Polytraumatisés et détresses respiratoires</small>
          <div class="capacity-stepper">
            <button data-action="adjust-bed" data-service="reanimation" data-delta="-1">-</button>
            <span id="cap-reanimation">${caps.reanimation}</span>
            <button data-action="adjust-bed" data-service="reanimation" data-delta="1">+</button>
          </div>
        </div>
        <div class="capacity-editor-box">
          <strong>Chirurgie d'Urgence</strong>
          <small>Salles d'opérations et lits de réveil</small>
          <div class="capacity-stepper">
            <button data-action="adjust-bed" data-service="chirurgie" data-delta="-1">-</button>
            <span id="cap-chirurgie">${caps.chirurgie}</span>
            <button data-action="adjust-bed" data-service="chirurgie" data-delta="1">+</button>
          </div>
        </div>
        <div class="capacity-editor-box">
          <strong>Traumatologie / Orthopédie</strong>
          <small>Fractures et traumatismes routiers</small>
          <div class="capacity-stepper">
            <button data-action="adjust-bed" data-service="traumatologie" data-delta="-1">-</button>
            <span id="cap-traumatologie">${caps.traumatologie}</span>
            <button data-action="adjust-bed" data-service="traumatologie" data-delta="1">+</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderAdmittedPatients() {
  return `
    ${moduleTop(moduleHeader("Dossiers Médicaux d'Urgence", "Fiches Patients Admis", "Données vitales et contacts d'urgence strictement limités aux patients pris en charge par votre établissement."))}
    <section class="module-card">
      <header><div><small>PATIENTS ACHEMINÉS</small><h2>Fiches médicales d'urgence reçues via QR Code</h2></div></header>
      <div class="compact-list">
        ${state.admittedPatients.map(p => `
          <div class="patient-record-card">
            <div class="patient-record-header">
              <div>
                <strong style="font-size:0.95rem;color:#FFF;">${escapeHtml(p.name)} (${p.age} ans)</strong>
                <small style="display:block;color:#8FA3B8;">Arrivée : ${p.arrival_time} · Motif : ${escapeHtml(p.incident_type)}</small>
              </div>
              <span class="blood-badge">Groupe : ${escapeHtml(p.blood_type)}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.75rem;margin-top:8px;">
              <div><span style="color:#8FA3B8;">Allergies déclarées :</span> <strong style="color:#FFF;">${escapeHtml(p.allergies)}</strong></div>
              <div><span style="color:#8FA3B8;">Statut :</span> <strong style="color:#4ADE80;">${escapeHtml(p.status)}</strong></div>
              <div style="grid-column:1/-1;"><span style="color:#8FA3B8;">Contact d'urgence :</span> <strong style="color:#FFF;">${escapeHtml(p.emergency_contact)}</strong></div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderFog() {
  return `
    ${moduleTop(moduleHeader("Résilience & Edge Computing", "Nœuds Fog & Continuité Opérationnelle", "Architecture locale garantissant le fonctionnement complet même en cas de panne internet."), `
      <section class="module-metrics">
        ${metricCard("Nœud Principal", "FOG-LOMÉ-01", "Centre opérationnel", "purple")}
        ${metricCard("Statut Résilience", isNetworkOffline ? "MODE LOCAL" : "EN LIGNE", isNetworkOffline ? "Hors-ligne actif" : "Synchronisé", isNetworkOffline ? "orange" : "green")}
        ${metricCard("Reroutage Anti-Trafic", "Activé", "Déviations automatiques", "blue")}
        ${metricCard("Latence Locale", "12 ms", "Temps de réponse Fog", "green")}
      </section>
    `)}
    <section class="module-grid">
      <article class="module-card">
        <header><div><small>FONCTIONNALITÉ CLÉ</small><h2>Continuité Hors-Ligne (Offline-First)</h2></div></header>
        <p style="color:#8FA3B8;font-size:0.8rem;line-height:1.5;">
          En cas de coupure de fibre ou de connectivité internet, la console LOTISEC bascule immédiatement et automatiquement sur le nœud local <strong>FOG-LOMÉ-01</strong>. Les opérateurs continuent d'enregistrer et de dispatcher les alertes sans interruption. Dès le rétablissement de la connexion, les données sont synchronisées de manière bidirectionnelle avec le Cloud national.
        </p>
        <button class="button button-secondary" data-action="test-offline" style="margin-top:10px;">
          ${isNetworkOffline ? "Simuler le retour en ligne" : "Simuler une coupure internet (Mode Hors-ligne)"}
        </button>
      </article>
      <article class="module-card">
        <header><div><small>GÉODÉCISION</small><h2>Moteur de Reroutage Anti-Trafic</h2></div></header>
        <p style="color:#8FA3B8;font-size:0.8rem;line-height:1.5;">
          Le Fog analyse en continu la fluidité des axes de Lomé. Lorsqu'un axe majeur (ex: Boulevard du 13 Janvier) est encombré, le système calcule une déviation prioritaire et redirige l'ambulance vers l'itinéraire le plus fluide.
        </p>
        <button class="button button-primary" data-action="toggle-reroute" style="margin-top:10px;">
          ${state.mission.routeBlocked ? "Rétablir l'axe direct" : "Simuler un axe bouché & Reroutage vert"}
        </button>
      </article>
    </section>
  `;
}

function renderMapPage() {
  return `
    ${moduleTop(moduleHeader("Carte Tactique", "Géodécision & Reroutage en Temps Réel", "Position des incidents, ambulances engagées et déviations anti-trafic."), `
      <div style="display:flex;gap:10px;margin-top:8px;">
        <button class="button button-secondary" data-action="toggle-reroute">${state.mission.routeBlocked ? "Rétablir la voie directe" : "Simuler congestion & Reroutage"}</button>
      </div>
    `)}
    <section class="module-card" style="padding:0;overflow:hidden;min-height:500px;">
      <div id="tactical-map" class="leaflet-host" style="height:500px;width:100%;"></div>
    </section>
  `;
}

function initTacticalMap() {
  const container = document.getElementById("tactical-map");
  if (!container || !window.L) return;
  destroyOperationalMaps();
  const map = L.map(container).setView([6.1588, 1.2101], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  // Marqueurs Hôpitaux
  hospitals.forEach(h => {
    L.marker([h.lat, h.lng]).bindPopup(`<strong>${escapeHtml(h.name)}</strong><br>${h.beds} places d'urgences`).addTo(map);
  });

  // Marqueur Incident
  L.marker([6.1588, 1.2101]).bindPopup("<strong>🚨 Incident Actif</strong><br>Boulevard du 13 Janvier").addTo(map);

  // Marqueur Ambulance
  L.marker([6.1761, 1.2058]).bindPopup("<strong>🚑 Sapeurs-Pompiers (118)</strong><br>En route").addTo(map);

  // Tracé d'itinéraire
  const directRoute = [[6.1761, 1.2058], [6.1697, 1.2076], [6.1588, 1.2101]];
  const detourRoute = [[6.1761, 1.2058], [6.1740, 1.2137], [6.1660, 1.2147], [6.1588, 1.2101]];

  if (state.mission.routeBlocked) {
    L.polyline(directRoute, { color: '#DC2626', weight: 5, dashArray: '6, 8' }).bindPopup("Axe congestionné").addTo(map);
    L.polyline(detourRoute, { color: '#16A34A', weight: 6 }).bindPopup("Déviation fluide calculée").addTo(map);
  } else {
    L.polyline(directRoute, { color: '#1B6CA8', weight: 6 }).addTo(map);
  }

  operationalMaps.push({ map });
}

function destroyOperationalMaps() {
  operationalMaps.forEach(({ map }) => { try { map.remove(); } catch {} });
  operationalMaps = [];
}

function renderInterventions() {
  return `
    ${moduleTop(moduleHeader("Missions Terrain", "Suivi des Interventions & Dispatching", "Supervision en direct de l'engagement des ambulances et sapeurs-pompiers."))}
    <section class="module-card">
      <header><div><small>MISSION EN COURS</small><h2>Sapeurs-Pompiers Lomé (118) → Accident Boulevard 13 Janvier</h2></div><em class="resource-status resource-status--busy">${state.mission.phase}</em></header>
      <div class="resource-facts">
        <span><small>Délai estimé</small><strong>5 min (2.1 km)</strong></span>
        <span><small>Hôpital Récepteur</small><strong>CHU Sylvanus Olympio</strong></span>
      </div>
      <div class="resource-actions">
        <button class="button button-primary" data-action="advance-phase">Étape suivante : Arrivé sur place</button>
        <button class="button button-secondary" data-action="go-module" data-target="Carte en direct">Voir sur la carte</button>
      </div>
    </section>
  `;
}

function renderAmbulances() {
  return `
    ${moduleTop(moduleHeader("Flotte Sanitaire", "Disponibilité des Ambulances & Secours", "Unités de secours connectées et prêtes à être engagées."))}
    <section class="fleet-grid">
      ${ambulances.map(a => `
        <article class="resource-card">
          <header><span class="resource-icon">🚑</span><div><small>${a.number}</small><h2>${escapeHtml(a.name)}</h2></div><em class="resource-status resource-status--${a.status==='Disponible'?'ok':'busy'}">${a.status}</em></header>
          <div class="resource-facts"><span><small>Équipage</small><strong>${a.crew} secouristes</strong></span><span><small>Distance base</small><strong>${a.distance} km</strong></span></div>
          <div class="resource-actions"><button data-action="go-module" data-target="Carte en direct">Localiser</button></div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderHospitals() {
  return `
    ${moduleTop(moduleHeader("Réseau Hospitalier", "Établissements de Santé du Togo", "Capacités d'accueil réelles certifiées pour l'orientation des blessés."))}
    <section class="hospital-grid">
      ${hospitals.map(h => `
        <article class="resource-card">
          <header><span class="resource-icon resource-icon--hospital">H</span><div><small>${escapeHtml(h.phone)}</small><h2>${escapeHtml(h.name)}</h2></div><em class="resource-status resource-status--ok">${h.beds} places</em></header>
          <p style="font-size:0.7rem;color:#8FA3B8;margin:6px 0;">${escapeHtml(h.address)}</p>
          <div class="resource-facts"><span><small>Spécialité</small><strong>${escapeHtml(h.specialty)}</strong></span><span><small>Occupation</small><strong>${h.occupancy}%</strong></span></div>
          <div class="resource-actions"><a class="button button-secondary" href="tel:${h.phone}" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">Appeler</a></div>
        </article>
      `).join('')}
    </section>
  `;
}

function renderStatistics() {
  return `
    ${moduleTop(moduleHeader("Indicateurs Stratégiques", "Statistiques & Temps de Réponse", "Performance opérationnelle de la chaîne de secours routier au Togo."))}
    <section class="module-metrics">
      ${metricCard("Alertes traitées", 48, "+14% ce mois", "blue")}
      ${metricCard("Délai moyen d'arrivée", "06 min 12 s", "Objectif < 8 min", "green")}
      ${metricCard("Taux de prise en charge", "98.2%", "Orientation réussie", "green")}
      ${metricCard("Urgences vitales", 11, "Polytraumatisés", "red")}
    </section>
  `;
}

function renderUsers() {
  return `
    ${moduleTop(moduleHeader("Administration", "Gestion des Utilisateurs & Rôles", "Contrôle d'accès institutionnel et habilitations des opérateurs.", '<button class="button button-primary" data-action="create-user">＋ Créer un compte</button>'))}
    <section class="module-card">
      <header><div><small>COMPTES ACTIFS</small><h2>Opérateurs, Pompiers & Hôpitaux</h2></div></header>
      <div class="compact-list">
        ${(state.adminUsers.length ? state.adminUsers : [
          { phone: "+228 90 00 00 01", first_name: "Superviseur", last_name: "National", roles: [{ role: "admin" }] },
          { phone: "+228 91 18 00 01", first_name: "Capitaine", last_name: "Pompiers Lomé", roles: [{ role: "firefighter" }] },
          { phone: "+228 22 21 25 01", first_name: "Dr. Lawson", last_name: "CHU Tokoin", roles: [{ role: "hospital_manager" }] }
        ]).map(u => `
          <span><strong>${escapeHtml(u.first_name || '')} ${escapeHtml(u.last_name || '')} (${escapeHtml(u.phone)})</strong><em>${(u.roles||[]).map(r=>r.role||r).join(', ')}</em></span>
        `).join('')}
      </div>
    </section>
  `;
}

function renderZem() {
  return `
    ${moduleTop(moduleHeader("Réseau Premier Répondant", "Accréditations Conducteurs Zem", "Supervision et validation des conducteurs taxi-motos secouristes.")) }
    <section class="module-card">
      <header><div><small>DOSSIERS</small><h2>Demandes d'accréditation en attente</h2></div></header>
      <div class="compact-list">
        ${(state.zemApplications.length ? state.zemApplications : [
          { id: "ZEM-TOGO-01", driver_name: "Koffi Agbeko", phone: "+228 90 44 33 22", status: "pending", zone: "Lomé Bè" }
        ]).map(z => `
          <span><strong>${escapeHtml(z.driver_name || z.id)} (${escapeHtml(z.phone)})</strong><button class="button button-secondary" data-action="review-zem" data-id="${z.id}">Examiner</button></span>
        `).join('')}
      </div>
    </section>
  `;
}

function renderAudit() {
  return `
    ${moduleTop(moduleHeader("Traçabilité", "Journal d'Audit Sécurisé", "Enregistrement légal et horodaté de toutes les actions opérationnelles.")) }
    <section class="module-card">
      <header><div><small>ÉVÉNEMENTS RÉCENTS</small><h2>Traçabilité RGPD & Régulation</h2></div></header>
      <div class="compact-list">
        <span><strong>Connexion opérateur réussie</strong><small>09/08/2026 13:40 · Administrateur</small></span>
        <span><strong>Alerte SOS validée et transmise</strong><small>09/08/2026 13:15 · Sapeurs-Pompiers 118</small></span>
        <span><strong>Capacité lits réanimation mise à jour</strong><small>09/08/2026 12:50 · CHU Sylvanus Olympio</small></span>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    ${moduleTop(moduleHeader("Configuration", "Paramètres de la Console", "Options d'affichage et connectivité des services.")) }
    <section class="module-card">
      <header><div><small>PRÉFÉRENCES</small><h2>Paramètres système</h2></div></header>
      <p style="color:#8FA3B8;font-size:0.8rem;">API connectée : ${API_BASE}</p>
    </section>
  `;
}

function renderCurrentModule() {
  const mod = state.currentModule;
  if (mod === "Incidents") {
    if (elements.incidentsPage) elements.incidentsPage.hidden = false;
    if (elements.dynamicPage) elements.dynamicPage.hidden = true;
    if (elements.topbarTitle) elements.topbarTitle.textContent = "Centre de réception des signalements";
    renderIncidents();
  } else {
    if (elements.incidentsPage) elements.incidentsPage.hidden = true;
    if (elements.dynamicPage) elements.dynamicPage.hidden = false;
    if (elements.topbarTitle) elements.topbarTitle.textContent = mod;
    destroyOperationalMaps();

    let html = "";
    if (mod === "Tableau de bord") html = renderDashboard();
    else if (mod === "Carte en direct") { html = renderMapPage(); setTimeout(initTacticalMap, 50); }
    else if (mod === "Interventions") html = renderInterventions();
    else if (mod === "Ambulances") html = renderAmbulances();
    else if (mod === "Hôpitaux") html = renderHospitals();
    else if (mod === "Capacités & Lits") html = renderHospitalCapacities();
    else if (mod === "Patients Admis") html = renderAdmittedPatients();
    else if (mod === "Fog Computing") html = renderFog();
    else if (mod === "Statistiques") html = renderStatistics();
    else if (mod === "Utilisateurs") html = renderUsers();
    else if (mod === "Accréditations Zem") html = renderZem();
    else if (mod === "Audit") html = renderAudit();
    else if (mod === "Paramètres") html = renderSettings();
    else html = `<div class="module-card"><h2>${escapeHtml(mod)}</h2><p>Contenu en cours de chargement…</p></div>`;

    if (elements.dynamicPage) elements.dynamicPage.innerHTML = html;
  }
}

function switchModule(name) {
  state.currentModule = name;
  document.querySelectorAll("[data-module]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.module === name);
  });
  renderCurrentModule();
}

function toast(title, msg) {
  const wrapper = document.createElement("div");
  wrapper.className = "toast";
  wrapper.innerHTML = `<i>✓</i><span><strong>${escapeHtml(title)}</strong><br><small>${escapeHtml(msg)}</small></span>`;
  const stack = document.querySelector("[data-toast-stack]") || document.body;
  stack.append(wrapper);
  setTimeout(() => wrapper.remove(), 4500);
}

// ----------------- EVENT LISTENERS ----------------- //

document.querySelectorAll("[data-module]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    switchModule(link.dataset.module);
    document.querySelector("[data-sidebar]")?.classList.remove("is-open");
  });
});

// SELECTEUR DE VUE ADMIN DYNAMIQUE
document.querySelector("[data-admin-view-selector]")?.addEventListener("change", (e) => {
  currentAdminView = e.target.value;
  applyRbac();
  if (currentAdminView === 'hospital') switchModule('Capacités & Lits');
  else if (currentAdminView === 'firefighter') switchModule('Incidents');
  else switchModule('Tableau de bord');
  toast('Espace modifié', `Affichage adapté pour le mode ${e.target.options[e.target.selectedIndex].text}`);
});

// GESTION DES CLICS DYNAMIQUES DANS LES PAGES
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "go-module") switchModule(btn.dataset.target);
  if (action === "open-incident") openDetail(btn.dataset.id);
  if (action === "create-user") elements.userModal?.showModal();
  if (action === "review-zem") elements.zemModal?.showModal();

  if (action === "adjust-bed") {
    const service = btn.dataset.service;
    const delta = parseInt(btn.dataset.delta, 10);
    if (state.hospitalCapacities[service] != null) {
      state.hospitalCapacities[service] = Math.max(0, state.hospitalCapacities[service] + delta);
      const span = document.getElementById(`cap-${service}`);
      if (span) span.textContent = state.hospitalCapacities[service];
      toast("Capacités synchronisées", `${service.toUpperCase()} : ${state.hospitalCapacities[service]} places.`);
    }
  }

  if (action === "test-offline") {
    setOfflineMode(!isNetworkOffline);
    renderCurrentModule();
  }

  if (action === "toggle-reroute") {
    state.mission.routeBlocked = !state.mission.routeBlocked;
    toast(state.mission.routeBlocked ? "Congestion détectée" : "Voie rétablie", state.mission.routeBlocked ? "Déviation calculée via itinéraire vert." : "Trajet direct rétabli.");
    renderCurrentModule();
  }
});

// GESTION DE CRÉATION MANUELLE D'INCIDENT
elements.manualForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(elements.manualForm);
  const inc = {
    id: `MAN-${Date.now().toString().slice(-6)}`,
    source: "manual",
    type: f.get("type"),
    severity: f.get("severity"),
    place: f.get("place"),
    lat: parseFloat(f.get("lat")) || 6.137,
    lng: parseFloat(f.get("lng")) || 1.212,
    victims: parseInt(f.get("victims"), 10) || 1,
    vehicles: parseInt(f.get("vehicles"), 10) || 1,
    description: f.get("description"),
    status: "new",
    score: 88,
    createdAt: Date.now()
  };
  ingestIncident(inc);
  elements.manualModal.close();
  elements.manualForm.reset();
  toast("Incident créé", "Le signalement a été ajouté à la file d'attente.");
});

document.querySelector("[data-open-manual]")?.addEventListener("click", () => elements.manualModal?.showModal());
document.querySelector("[data-close-manual]")?.addEventListener("click", () => elements.manualModal?.close());
document.querySelector("[data-close-detail]")?.addEventListener("click", () => elements.detail?.close());
document.querySelector("[data-emergency]")?.addEventListener("click", () => document.querySelector("[data-emergency-modal]")?.showModal());
document.querySelector("[data-close-emergency]")?.addEventListener("click", () => document.querySelector("[data-emergency-modal]")?.close());
document.querySelector("[data-close-user]")?.addEventListener("click", () => elements.userModal?.close());
document.querySelector("[data-close-grant-role]")?.addEventListener("click", () => elements.grantRoleModal?.close());
document.querySelector("[data-close-zem]")?.addEventListener("click", () => elements.zemModal?.close());
document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => document.querySelector("[data-sidebar]")?.classList.toggle("is-open"));

// RECHERCHE ET FILTRES
document.querySelector("[data-search]")?.addEventListener("input", (e) => {
  state.search = e.target.value;
  renderIncidents();
});
document.querySelectorAll("[data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("is-active", b === btn));
    renderIncidents();
  });
});

// HORLOGE TOPBAR
setInterval(() => {
  const clock = document.querySelector("[data-clock]");
  if (clock) clock.textContent = new Date().toLocaleTimeString("fr-FR");
}, 1000);

async function loadOperationalData() {
  if (!session?.token) return;
  try {
    const [fac, res, inc, adm] = await Promise.all([
      apiFetch('/api/v1/facilities').catch(() => ({ facilities: [] })),
      apiFetch('/api/v1/resources').catch(() => ({ resources: [] })),
      apiFetch('/api/v1/incidents').catch(() => ({ incidents: [] })),
      apiFetch('/api/v1/admissions').catch(() => ({ admissions: [] }))
    ]);
    if (fac?.facilities?.length) hospitals.splice(0, hospitals.length, ...fac.facilities);
    if (res?.resources?.length) ambulances.splice(0, ambulances.length, ...res.resources);
    if (inc?.incidents?.length) {
      inc.incidents.forEach(item => {
        if (!state.incidents.some(i => i.id === item.id)) state.incidents.unshift(item);
      });
      saveIncidents();
    }
  } catch (e) { console.log('Erreur chargement:', e); }
}

async function pollMobileApi() {
  if (!session?.token) return;
  try {
    const res = await apiFetch('/api/v1/incidents');
    if (res?.incidents) {
      res.incidents.forEach(item => {
        if (!state.incidents.some(i => i.id === item.id)) ingestIncident(item);
      });
    }
  } catch {}
}

function startRealtime() {
  setOfflineMode(false);
  setInterval(pollMobileApi, 6000);
}

// INITIALISATION
(async () => {
  if (session?.user) {
    applyRbac();
    startRealtime();
    await loadOperationalData();
    renderCurrentModule();
  } else {
    showLogin();
  }
})();
