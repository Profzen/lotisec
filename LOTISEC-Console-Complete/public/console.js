const STORAGE_KEY = "lotisec:incident-feed:v3";
const EVENT_KEY = "lotisec:mobile-event";
const THEME_KEY = "lotisec:theme";
const AUTH_KEY = "lotisec:console-session:v1";
const API_BASE = (window.LOTISEC_API_URL || localStorage.getItem("lotisec:api-url") || "https://lotisec-backend.vercel.app").replace(/\/$/, "");
const API_URL = `${API_BASE}/api/v1/incidents`;
const channel = "BroadcastChannel" in window ? new BroadcastChannel("lotisec-incidents") : null;

let session = (() => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch { return null; } })();
const CONSOLE_ROLES = new Set(["admin","supervisor","dispatcher","firefighter","ambulance_driver","hospital_manager","hospital_agent"]);

function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers, cache: options.cache || "no-store" }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { localStorage.removeItem(AUTH_KEY); session = null; showLogin(); }
    if (!response.ok) throw new Error(body.detail || body.error || `Erreur API ${response.status}`);
    return body;
  });
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
        session = { token:result.token, realtimeToken:result.realtime_token, user:result.user }; localStorage.setItem(AUTH_KEY, JSON.stringify(session)); overlay.remove(); applyRbac(); startRealtime(); await loadOperationalData(); await pollMobileApi();
      } catch (err) { error.textContent = err.message || "Connexion impossible"; }
    });
  }
  overlay.querySelector("[data-login-message]").textContent = message || "Connectez-vous avec votre compte professionnel.";
}

function applyRbac() {
  if (!session?.user) return showLogin();
  const roles = session.user.roles || []; const permissions = session.user.permissions || [];
  const can = (permission) => permissions.includes("*") || permissions.includes(permission); const allowed = new Set();
  if (can("incidents:read")) ["Tableau de bord","Incidents","Carte en direct","Statistiques","Notifications"].forEach((x)=>allowed.add(x));
  if (can("interventions:read") || can("interventions:manage") || can("interventions:assigned")) ["Tableau de bord","Interventions","Carte en direct","Ambulances","Notifications"].forEach((x)=>allowed.add(x));
  if (can("admissions:organization") || can("facilities:manage")) ["Tableau de bord","Hôpitaux","Interventions","Statistiques","Notifications"].forEach((x)=>allowed.add(x));
  if (roles.includes("admin")) document.querySelectorAll("[data-module]").forEach((el)=>allowed.add(el.dataset.module));
  if (can('zem:approve')) allowed.add('Accréditations Zem');
  document.querySelectorAll("[data-module]").forEach((el) => { el.hidden = !allowed.has(el.dataset.module); });
  document.querySelectorAll('[data-open-mobile]').forEach((el) => { el.hidden = !demoMode; });
  const card = document.querySelector(".operator-card span:nth-child(2)");
  if (card) card.innerHTML = `<small>${session.user.organization?.name || "LOTISEC"}</small><strong>${session.user.first_name || session.user.phone}</strong><em><i></i> ${roles.join(" · ")}</em>`;
  const organizations = session.user.organizations || [];
  if (organizations.length > 1 && !document.querySelector('[data-organization-switch]')) {
    const select = document.createElement('select'); select.dataset.organizationSwitch = '';
    select.innerHTML = organizations.map((item)=>`<option value="${item.id}" ${item.id===session.user.organizationId?'selected':''}>${escapeHtml(item.name)}</option>`).join('');
    select.addEventListener('change', async () => {
      try {
        const result = await apiFetch('/auth/switch-organization', { method:'POST', body:JSON.stringify({ organization_id:select.value }) });
        session.token=result.token; session.realtimeToken=result.realtime_token; session.user={...session.user,...result.session};
        localStorage.setItem(AUTH_KEY,JSON.stringify(session)); location.reload();
      } catch (error) { toast('Changement refusé',error.message); }
    });
    document.querySelector('.topbar-actions')?.prepend(select);
  }
}

function canPermission(permission) {
  const permissions = session?.user?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
}

const now = Date.now();
const demoIncidents = [
  {
    id: "INC-2026-0729-014", source: "mobile", type: "Collision multiple", severity: "critical",
    place: "Boulevard du 13 Janvier, près de GTA", lat: 6.1588, lng: 1.2101, accuracy: 7,
    victims: 4, vehicles: 3, photos: 2,
    description: "Collision impliquant deux voitures et une moto. La circulation est fortement perturbée.",
    flags: ["Circulation perturbée", "Victime potentiellement coincée"], status: "new",
    score: 96, latency: 31, createdAt: now - 92000, device: "Android · LOTISEC 1.4.0",
    reporter: "+228 •• •• 41 08"
  },
  {
    id: "INC-2026-0729-013", source: "mobile", type: "Renversement de moto", severity: "high",
    place: "Agoè, carrefour Deux Lions", lat: 6.2051, lng: 1.2069, accuracy: 9,
    victims: 2, vehicles: 2, photos: 1,
    description: "Une moto et un taxi sont impliqués. Une victime est au sol mais consciente.",
    flags: ["Victime consciente", "Circulation ralentie"], status: "new",
    score: 81, latency: 44, createdAt: now - 294000, device: "Android · LOTISEC 1.4.0",
    reporter: "+228 •• •• 73 22"
  },
  {
    id: "INC-2026-0729-012", source: "manual", type: "Accident de la route", severity: "high",
    place: "Bè, route de Kpalimé", lat: 6.1267, lng: 1.2249, accuracy: 18,
    victims: 1, vehicles: 2, photos: 0, description: "Signalement reçu par téléphone. Collision avec un blessé.",
    flags: ["Axe partiellement bloqué"], status: "validated", score: 75, latency: 58,
    createdAt: now - 612000, device: "Console opérateur", reporter: "Appel téléphonique"
  },
  {
    id: "INC-2026-0729-011", source: "simulation", type: "Piéton percuté", severity: "medium",
    place: "Adidogomé, boulevard du 30 Août", lat: 6.1871, lng: 1.1757, accuracy: 12,
    victims: 1, vehicles: 1, photos: 1, description: "Scénario de démonstration opérationnelle.",
    flags: ["Victime consciente"], status: "assigned", score: 62, latency: 39,
    createdAt: now - 1030000, device: "Simulateur LOTISEC", reporter: "Scénario terrain"
  }
];
const initialIncidents = new URLSearchParams(location.search).get("demo") === "1" ? demoIncidents : [];

const ambulances = [
  { id: "AMB-01", name: "Secours Abalo", number: "8880", crew: 3, distance: 2.4, eta: 6, status: "En mission", lat: 6.1761, lng: 1.2058 },
  { id: "AMB-02", name: "Togo Assistance", number: "8200", crew: 2, distance: 3.8, eta: 9, status: "Disponible", lat: 6.1645, lng: 1.2311 },
  { id: "AMB-03", name: "Sapeurs-pompiers", number: "118", crew: 4, distance: 5.7, eta: 13, status: "Disponible", lat: 6.1418, lng: 1.2184 },
  { id: "AMB-04", name: "Dogta Lafiè", number: "—", crew: 2, distance: 7.2, eta: 17, status: "Maintenance", lat: 6.2023, lng: 1.1854 }
];

const hospitals = [
  {
    id: "HSP-01", name: "CHU Sylvanus Olympio", beds: 5, occupancy: 82, distance: 1.2, eta: 3,
    specialty: "Traumatologie", lat: 6.1374, lng: 1.2122, phone: "+228 22 21 25 01",
    address: "Boulevard du 13 Janvier, Lomé", services: ["Urgences 24 h/24", "Traumatologie", "Chirurgie", "Imagerie"]
  },
  {
    id: "HSP-02", name: "CHU Campus Lomé", beds: 8, occupancy: 74, distance: 3.5, eta: 7,
    specialty: "Urgences polyvalentes", lat: 6.1756, lng: 1.2137, phone: "+228 22 25 47 01",
    address: "Campus universitaire, Lomé", services: ["Urgences", "Médecine interne", "Pédiatrie", "Laboratoire"]
  },
  {
    id: "HSP-03", name: "Hôpital de Bè", beds: 2, occupancy: 91, distance: 4.3, eta: 9,
    specialty: "Soins d'urgence", lat: 6.1322, lng: 1.2402, phone: "+228 22 21 16 41",
    address: "Quartier Bè, Lomé", services: ["Accueil d'urgence", "Soins généraux", "Maternité"]
  },
  {
    id: "HSP-04", name: "Hôpital Dogta-Lafiè", beds: 11, occupancy: 63, distance: 7.6, eta: 16,
    specialty: "Imagerie et chirurgie", lat: 6.2105, lng: 1.1854, phone: "+228 22 53 70 00",
    address: "Agoè-Nyivé, Lomé", services: ["Urgences", "Chirurgie", "Imagerie", "Réanimation"]
  }
];

const demoMode = new URLSearchParams(location.search).get("demo") === "1";
if (!demoMode) {
  ambulances.splice(0, ambulances.length);
  hospitals.splice(0, hospitals.length);
}

const trafficSegments = [
  { id: "TR-01", name: "Bd. du 13 Janvier", level: "Fluide", speed: 48 },
  { id: "TR-02", name: "Route d'Atakpamé", level: "Modéré", speed: 31 },
  { id: "TR-03", name: "Carrefour GTA", level: "Dense", speed: 18 },
  { id: "TR-04", name: "Bd. circulaire", level: "Fluide", speed: 52 }
];

const primaryRoute = [
  [6.1761, 1.2058],
  [6.1728, 1.2064],
  [6.1697, 1.2076],
  [6.1662, 1.2082],
  [6.1627, 1.2093],
  [6.1588, 1.2101]
];

const alternateRoute = [
  [6.1761, 1.2058],
  [6.1740, 1.2100],
  [6.1703, 1.2137],
  [6.1660, 1.2147],
  [6.1622, 1.2130],
  [6.1588, 1.2101]
];

const hospitalRoute = [
  [6.1588, 1.2101],
  [6.1534, 1.2095],
  [6.1482, 1.2102],
  [6.1431, 1.2111],
  [6.1374, 1.2122]
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
  notifications: demoMode ? [
    { id: 1, title: "Nouvel incident critique", text: "Collision multiple signalée près de GTA.", unread: true },
    { id: 2, title: "Ambulance en route", text: "Secours Abalo a accepté la mission.", unread: true },
    { id: 3, title: "Capacité hospitalière", text: "Le CHU Campus Lomé annonce 8 places.", unread: true }
  ] : [],
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
  mission: demoMode ? {
    incidentId: "INC-2026-0729-011",
    ambulanceId: "AMB-01",
    hospitalId: "HSP-01",
    progress: 8,
    phase: "En route",
    totalDistance: 2.4,
    speed: 42,
    routeBlocked: false,
    follow: true,
    startedAt: Date.now()
  } : null
};

const elements = {
  list: document.querySelector("[data-incident-list]"),
  empty: document.querySelector("[data-empty-state]"),
  template: document.querySelector("#incident-template"),
  detail: document.querySelector("[data-detail-drawer]"),
  detailContent: document.querySelector("[data-detail-content]"),
  manualModal: document.querySelector("[data-manual-modal]"),
  mobileModal: document.querySelector("[data-mobile-modal]"),
  manualForm: document.querySelector("[data-manual-form]"),
  mobileForm: document.querySelector("[data-mobile-form]"),
  banner: document.querySelector("[data-incoming-banner]"),
  bannerCopy: document.querySelector("[data-incoming-copy]"),
  map: document.querySelector("[data-live-map]"),
  incidentPage: document.querySelector('[data-page="incidents"]'),
  dynamicPage: document.querySelector("[data-dynamic-page]")
};

function loadIncidents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved.filter((item) => item.source !== "simulation");
  } catch {}
  return initialIncidents;
}

function saveIncidents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.incidents.slice(0, 100)));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sourceLabel(source) {
  return { mobile: "Application mobile", web:"Portail web", operator:"Opérateur", ussd:"USSD", partner:"Partenaire", manual: "Création manuelle", simulation: "Simulation" }[source] || source;
}

function statusLabel(status) {
  return {
    new: "À valider", validated: "Validé", prioritized: "Priorisé", assigned: "Affectée",
    accepted: "Acceptée", enroute: "En route", en_route:"En route", onsite: "Sur place", on_scene:"Sur place",
    patient_loaded:"Patient pris en charge", to_hospital:"Vers l'hôpital", arrived_hospital:"Arrivée hôpital",
    hospital: "Vers l'hôpital", completed: "Terminée", rejected: "Classé", cancelled:"Annulé"
  }[status] || status;
}

function severityLabel(severity) {
  return { critical: "Critique", high: "Élevée", medium: "Moyenne", low: "Faible" }[severity] || severity;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(timestamp);
}

function formatRelative(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - Number(timestamp)) / 1000));
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h`;
}

function generateId() {
  const index = String(Math.floor(Math.random() * 900) + 100);
  const date = new Date();
  return `INC-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${index}`;
}

function computeScore({ severity, victims, vehicles, flags = [] }) {
  const base = { critical: 78, high: 62, medium: 42, low: 24 }[severity] || 40;
  return Math.min(99, base + Math.min(Number(victims) * 3, 12) + Math.min(Number(vehicles) * 2, 8) + Math.min(flags.length * 2, 6));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
}

function filteredIncidents() {
  const query = state.search.toLowerCase().trim();
  return state.incidents.filter((incident) => {
    const matchesSource = state.filter === "all" || incident.source === state.filter;
    const haystack = `${incident.id} ${incident.type} ${incident.place}`.toLowerCase();
    return matchesSource && (!query || haystack.includes(query));
  });
}

function renderIncidents() {
  if (!elements.list) return;
  const incidents = filteredIncidents();
  elements.list.innerHTML = "";
  incidents.forEach((incident) => {
    const fragment = elements.template.content.cloneNode(true);
    const row = fragment.querySelector(".incident-row");
    row.dataset.severity = incident.severity;
    row.dataset.source = incident.source;
    row.classList.toggle("is-new", incident.status === "new");
    fragment.querySelector(".source-badge").textContent = sourceLabel(incident.source);
    fragment.querySelector("time").textContent = formatRelative(incident.createdAt);
    fragment.querySelector("time").dateTime = new Date(incident.createdAt).toISOString();
    fragment.querySelector(".fresh-badge").hidden = Date.now() - incident.createdAt > 180000;
    fragment.querySelector(".incident-type").textContent = incident.type;
    fragment.querySelector(".incident-place").textContent = `⌖ ${incident.place || "Adresse non renseignée · GPS disponible"}`;
    fragment.querySelector(".victim-count").textContent = incident.victims;
    fragment.querySelector(".vehicle-count").textContent = incident.vehicles;
    fragment.querySelector(".gps-accuracy").textContent = `±${incident.accuracy} m`;
    fragment.querySelector(".priority-score").textContent = `${incident.score}/100`;
    const status = fragment.querySelector(".status-badge");
    status.textContent = statusLabel(incident.status);
    status.classList.add(`status-${incident.status}`);
    fragment.querySelector(".incident-main").addEventListener("click", () => openDetail(incident.id));
    elements.list.append(fragment);
  });
  elements.empty.hidden = incidents.length > 0;
  updateCounters();
  const selected = state.incidents.find((incident) => incident.id === state.selectedId) || incidents[0] || state.incidents[0];
  if (selected) updateMap(selected);
}

function updateCounters() {
  const active = state.incidents.filter((item) => item.status !== "rejected");
  const mobile = active.filter((item) => item.source === "mobile");
  const manual = active.filter((item) => item.source === "manual");
  const simulations = active.filter((item) => item.source === "simulation");
  const fresh = active.filter((item) => item.status === "new");
  const validated = active.filter((item) => !["new", "rejected"].includes(item.status));
  const averageLatency = mobile.length ? Math.round(mobile.reduce((sum, item) => sum + Number(item.latency || 0), 0) / mobile.length) : 0;
  setText("[data-metric-new]", fresh.length);
  setText("[data-metric-mobile]", mobile.length);
  setText("[data-metric-latency]", averageLatency);
  setText("[data-metric-validated]", validated.length);
  setText("[data-filter-all]", active.length);
  setText("[data-filter-mobile]", mobile.length);
  setText("[data-filter-manual]", manual.length);
  setText("[data-filter-simulation]", simulations.length);
  setText("[data-nav-incident-count]", fresh.length);
  const unread = state.notifications.filter((item) => item.unread).length;
  setText("[data-notification-count]", unread);
}

function updateMap(incident) {
  state.selectedId = incident.id;
  setText("[data-map-title]", incident.place || `${incident.type} · position GPS`);
  setText("[data-map-lat]", Number(incident.lat).toFixed(6));
  setText("[data-map-lng]", Number(incident.lng).toFixed(6));
  setText("[data-map-accuracy]", `± ${incident.accuracy} m`);
  setText("[data-fog-score]", `${incident.score}/100`);
  setText("[data-fog-latency]", `${incident.latency} ms`);
  const src = `https://www.google.com/maps?q=${encodeURIComponent(`${incident.lat},${incident.lng}`)}&z=15&output=embed`;
  if (elements.map && elements.map.dataset.current !== incident.id) {
    elements.map.src = src;
    elements.map.dataset.current = incident.id;
  }
}

function openDetail(id) {
  const incident = state.incidents.find((item) => item.id === id);
  if (!incident) return;
  updateMap(incident);
  const flags = incident.flags?.length
    ? incident.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")
    : "<span>Aucun danger complémentaire déclaré</span>";
  const actionLabel = incident.status === "new" ? "Valider et prioriser" : incident.status === "validated" ? "Affecter une ambulance" : "Ouvrir le suivi opérationnel";
  const actionName = incident.status === "new" ? "validate" : incident.status === "validated" ? "assign" : "track";
  elements.detailContent.innerHTML = `
    <header class="detail-hero">
      <span class="detail-source">${escapeHtml(sourceLabel(incident.source))} · réception temps réel</span>
      <h2>${escapeHtml(incident.type)}</h2>
      <p>⌖ ${escapeHtml(incident.place || "Adresse non renseignée — position GPS disponible")}</p>
      <div class="detail-id"><span>${escapeHtml(incident.id)}</span><span>${formatTime(incident.createdAt)} · ${escapeHtml(statusLabel(incident.status))}</span></div>
    </header>
    <section class="detail-section">
      <h3>Données principales du signalement</h3>
      <div class="detail-grid">
        <div class="detail-stat"><small>Victimes</small><strong>${incident.victims}</strong></div>
        <div class="detail-stat"><small>Véhicules impliqués</small><strong>${incident.vehicles}</strong></div>
        <div class="detail-stat"><small>Gravité</small><strong>${escapeHtml(severityLabel(incident.severity))}</strong></div>
        <div class="detail-stat"><small>Photos</small><strong>${incident.photos || 0}</strong></div>
        <div class="detail-stat"><small>Coordonnées GPS reçues</small><strong>${Number(incident.lat).toFixed(5)}, ${Number(incident.lng).toFixed(5)}</strong></div>
        <div class="detail-stat"><small>Précision</small><strong>± ${incident.accuracy} m</strong></div>
      </div>
    </section>
    <section class="detail-section">
      <h3>Caractéristiques déclarées</h3>
      <div class="tag-list">${flags}</div>
      <p class="detail-description" style="margin-top:14px">${escapeHtml(incident.description || "Aucune observation complémentaire.")}</p>
    </section>
    <section class="detail-section">
      <h3>Analyse Fog</h3>
      <div class="sync-timeline">
        <div class="sync-event"><i>✓</i><span><strong>Position reçue</strong><small>API mobile sécurisée</small></span><time>${formatTime(incident.createdAt)}</time></div>
        <div class="sync-event"><i>✓</i><span><strong>Contrôle GPS et doublons</strong><small>Coordonnées exploitables</small></span><time>+ ${Math.max(8, incident.latency - 18)} ms</time></div>
        <div class="sync-event"><i>✓</i><span><strong>Priorisation locale</strong><small>Score ${incident.score}/100</small></span><time>+ ${incident.latency} ms</time></div>
        <div class="sync-event"><i>✓</i><span><strong>Ambulance recommandée</strong><small>Secours Abalo · ETA 6 min</small></span><time>Temps réel</time></div>
      </div>
    </section>
    <div class="drawer-actions">
      <button class="button button-danger" type="button" data-detail-action="reject">Classer / doublon</button>
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
    updateIncidentStatus(incident, "rejected");
    toast("Signalement classé", "L'alerte a été retirée de la file active.");
  } else if (action === "validate") {
    incident.status = "validated";
    updateIncidentStatus(incident, "validated");
    toast("Incident validé", "Fog recommande Secours Abalo, à 2,4 km.");
  } else if (action === "assign") {
    const availableUnit = ambulances.find((item) => item.status === "Disponible");
    if (availableUnit) assignMission(incident.id, availableUnit.id);
    else toast("Aucune unité disponible", "Ouvrez le module Ambulances pour consulter les ressources.");
  } else {
    switchModule("Interventions");
    toast("Suivi opérationnel", "La mission synchronisée est affichée.");
  }
  saveIncidents();
  renderIncidents();
  if (elements.detail.open) elements.detail.close();
}

async function updateIncidentStatus(incident, status) {
  try { await apiFetch(`/api/v1/incidents/${incident.id}/status`, { method:"PATCH", body:JSON.stringify({status}) }); }
  catch (error) { toast("Synchronisation refusée", error.message); }
}

async function assignMission(incidentId, ambulanceId) {
  const incident = state.incidents.find((item) => item.id === incidentId);
  const ambulance = ambulances.find((item) => item.id === ambulanceId);
  if (!incident || !ambulance) return;
  try {
    await apiFetch(`/api/v1/incidents/${incidentId}/assignments`, { method:"POST", body:JSON.stringify({
      organization_id: ambulance.organizationId, response_unit_id: ambulance.id
    }) });
  } catch (error) { toast("Affectation refusée", error.message); return; }
  incident.status = "assigned";
  state.mission = {
    incidentId, ambulanceId, hospitalId: null, progress: 1, phase: "Affectée",
    totalDistance: ambulance.distance, speed: 0, routeBlocked: false, follow: true, startedAt: Date.now()
  };
  ambulances.forEach((item) => { if (item.id === ambulanceId) item.status = "En mission"; });
  saveIncidents();
  toast("Ambulance affectée", `${ambulance.name} reçoit la mission et apparaît sur la carte.`);
  window.setTimeout(() => {
    if (state.mission.incidentId === incidentId) {
      state.mission.phase = "En route";
      state.mission.speed = 42;
      incident.status = "enroute";
    }
  }, 1800);
}

function ingestIncident(incident, { announce = true } = {}) {
  if (!incident?.id || state.incidents.some((item) => item.id === incident.id)) return;
  if (state.paused) {
    state.queuedEvents.push(incident);
    toast("Flux en pause", "Le signalement est conservé dans la file tampon.");
    return;
  }
  state.incidents.unshift(incident);
  state.latestId = incident.id;
  saveIncidents();
  renderIncidents();
  updateLastSync();
  if (announce) showIncoming(incident);
  if (state.currentModule !== "Incidents") renderCurrentModule();
}

function showIncoming(incident) {
  elements.banner.hidden = false;
  elements.bannerCopy.textContent = `${incident.type} · ${incident.place || "position GPS uniquement"} · ${incident.victims} victime(s)`;
  state.notifications.unshift({ id: Date.now(), title: "Signalement mobile reçu", text: `${incident.id} · ${incident.type}`, unread: true });
  updateCounters();
  toast("Nouveau signalement mobile", `${incident.victims} victime(s) · score Fog ${incident.score}/100`);
  window.setTimeout(() => { elements.banner.hidden = true; }, 12000);
}

function formIncident(form, source) {
  const data = new FormData(form);
  const flags = [];
  if (data.get("roadBlocked")) flags.push(source === "mobile" ? "Circulation perturbée" : "Axe partiellement bloqué");
  if (data.get("trapped")) flags.push("Victime potentiellement coincée");
  if (data.get("fire")) flags.push("Présence de feu ou fumée");
  if (data.get("hazard")) flags.push("Matière dangereuse suspectée");
  if (data.get("conscious")) flags.push("Victime consciente");
  const incident = {
    id: generateId(),
    source,
    type: data.get("type"),
    severity: data.get("severity"),
    place: data.get("place")?.trim(),
    lat: Number(data.get("lat")),
    lng: Number(data.get("lng")),
    accuracy: Number(data.get("accuracy") || (source === "mobile" ? 8 : 16)),
    victims: Number(data.get("victims")),
    vehicles: Number(data.get("vehicles")),
    photos: Number(data.get("photos") || 0),
    description: data.get("description")?.trim(),
    flags,
    status: "new",
    latency: Math.floor(Math.random() * 31) + 24,
    createdAt: Date.now(),
    device: source === "mobile" ? "Android · LOTISEC 1.4.0" : "Console opérateur",
    reporter: source === "mobile" ? "Usager public · SOS mobile" : "Opérateur LS1"
  };
  incident.score = computeScore(incident);
  return incident;
}

async function sendMobileIncident(incident) {
  let storedIncident = incident;
  try {
    const result = await apiFetch("/api/v1/incidents", { method: "POST", body: JSON.stringify({
      source: incident.source === "manual" ? "operator" : "mobile", type: incident.type, severity: incident.severity,
      latitude: incident.lat, longitude: incident.lng, accuracy: incident.accuracy, address: incident.place,
      victims: incident.victims, vehicles: incident.vehicles, description: incident.description, flags: incident.flags,
      client_event_id: incident.id
    }) });
    storedIncident = normalizeApiIncident(result.incident);
    state.apiCursor = Math.max(state.apiCursor, Number(storedIncident.updatedAt || storedIncident.createdAt || 0));
  } catch (error) {
    toast("Incident non transmis", error.message || "L’API LOTISEC est indisponible.");
    return null;
  }
  channel?.postMessage({ type: "incident.created", payload: storedIncident });
  localStorage.setItem(EVENT_KEY, JSON.stringify({ nonce: crypto.randomUUID?.() || Math.random(), incident: storedIncident }));
  ingestIncident(storedIncident);
  return storedIncident;
}

async function pollMobileApi() {
  if (!session?.token) return;
  try {
    const result = await apiFetch(`/api/v1/incidents${state.apiCursor ? `?since=${encodeURIComponent(new Date(state.apiCursor).toISOString())}` : ""}`);
    (result.incidents || []).map(normalizeApiIncident).forEach((incident) => {
      state.apiCursor = Math.max(state.apiCursor, Number(incident.updatedAt || incident.createdAt || 0));
      const existing = state.incidents.find((item) => item.id === incident.id);
      if (existing) Object.assign(existing, incident);
      else ingestIncident(incident);
    });
    renderIncidents();
  } catch {}
}

function normalizeApiIncident(item) {
  return { id:item.id, source:item.source, type:item.type, severity:item.severity, place:item.address || "",
    lat:Number(item.latitude), lng:Number(item.longitude), accuracy:Number(item.accuracy || 0), victims:Number(item.victims || 0),
    vehicles:Number(item.vehicles || 0), photos:0, description:item.description || "", flags:item.flags || [], status:item.status,
    score:Number(item.priority_score || 0), latency:0, createdAt:new Date(item.created_at).getTime(), updatedAt:new Date(item.updated_at || item.created_at).getTime(), device:`Client ${item.source}`, reporter:"Utilisateur LOTISEC" };
}

let realtimeClient = null;
function setConnectionMode(label) { setText('[data-connection-mode]',label); }
function startRealtime() {
  if (!session?.realtimeToken || !window.supabase || !window.LOTISEC_SUPABASE_URL || !window.LOTISEC_SUPABASE_ANON_KEY) { setConnectionMode('POLLING API AUTHENTIFIÉ'); return; }
  realtimeClient = window.supabase.createClient(window.LOTISEC_SUPABASE_URL, window.LOTISEC_SUPABASE_ANON_KEY, { accessToken: async () => {
    const result = await apiFetch('/auth/realtime-token', { method:'POST' });
    session.realtimeToken = result.token; localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    return result.token;
  } });
  realtimeClient.channel('lotisec-console-incidents')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'incidents' }, (payload) => ingestIncident(normalizeApiIncident(payload.new)))
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'incidents' }, () => pollMobileApi())
    .on('postgres_changes', { event:'*', schema:'public', table:'interventions' }, async () => { await loadOperationalData(); renderCurrentModule(); })
    .on('postgres_changes', { event:'*', schema:'public', table:'facility_capacities' }, async () => { await loadOperationalData(); renderCurrentModule(); })
    .on('postgres_changes', { event:'*', schema:'public', table:'hospital_admission_requests' }, async () => { await loadOperationalData(); renderCurrentModule(); })
    .on('postgres_changes', { event:'*', schema:'public', table:'response_units' }, async () => { await loadOperationalData(); renderCurrentModule(); })
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'operational_notifications' }, async () => { await loadOperationalData(); updateCounters(); renderCurrentModule(); })
    .subscribe((status)=>setConnectionMode(status==='SUBSCRIBED'?'SUPABASE REALTIME ACTIF':'POLLING API AUTHENTIFIÉ'));
}

async function loadOperationalData() {
  if (!session?.token) return;
  const [facilityResult, resourceResult, interventionResult, admissionResult, notificationResult, responderResult, accidentGeoResult, accidentStatsResult] = await Promise.all([
    apiFetch('/api/v1/facilities').catch(() => ({ facilities:[] })),
    apiFetch('/api/v1/resources').catch(() => ({ resources:[] })),
    apiFetch('/api/v1/interventions').catch(() => ({ interventions:[] })),
    apiFetch('/api/v1/admissions').catch(() => ({ admissions:[] })),
    apiFetch('/api/v1/notifications').catch(() => ({ notifications:[] })),
    apiFetch('/responders').catch(() => []),
    apiFetch('/accidents/geojson').catch(() => ({ features:[] })),
    apiFetch('/accidents/stats').catch(() => null)
  ]);
  state.interventions = interventionResult.interventions || [];
  state.admissions = admissionResult.admissions || [];
  state.notifications = (notificationResult.notifications || []).map((item)=>({id:item.id,title:item.title,text:item.message,unread:!item.read_at,createdAt:item.created_at}));
  state.responders = Array.isArray(responderResult) ? responderResult : [];
  state.accidentGeojson = accidentGeoResult || {features:[]};
  state.accidentStats = accidentStatsResult;
  if ((session.user.roles || []).includes('admin')) {
    const [usersResult, organizationsResult, auditResult] = await Promise.all([
      apiFetch('/api/v1/admin/users').catch(() => ({ users:[] })),
      apiFetch('/api/v1/organizations').catch(() => ({ organizations:[] })),
      apiFetch('/api/v1/audit').catch(() => ({ logs:[] }))
    ]);
    state.adminUsers = usersResult.users || [];
    state.organizations = organizationsResult.organizations || [];
    state.auditLogs = auditResult.logs || [];
  }
  if ((session.user.permissions || []).includes('*') || (session.user.permissions || []).includes('zem:approve')) {
    const result = await apiFetch('/api/v1/zem/applications').catch(() => ({ applications:[] }));
    state.zemApplications = result.applications || [];
  }
  if (canPermission('organization:members') && session.user.organizationId) {
    const result = await apiFetch(`/api/v1/organizations/${session.user.organizationId}/members`).catch(()=>({members:[]}));
    state.organizationMembers = result.members || [];
  }
  if (facilityResult.facilities.length) {
    hospitals.splice(0, hospitals.length, ...facilityResult.facilities.map((item) => {
      const capacities = item.capacities || []; const available = capacities.reduce((sum, cap) => sum + Number(cap.available || 0), 0);
      const total = capacities.reduce((sum, cap) => sum + Number(cap.total || 0), 0);
      return { id:item.id, name:item.name, beds:available, occupancy:total ? Math.round((1-available/total)*100) : 0,
        distance:0, eta:0, specialty:capacities.filter((cap)=>cap.operational).map((cap)=>cap.service).join(', ') || 'Urgences',
        lat:Number(item.latitude || 0), lng:Number(item.longitude || 0), phone:item.phone || '—', address:item.address || '', services:capacities.map((cap)=>cap.service) };
    }));
  }
  if (resourceResult.resources.length) {
    ambulances.splice(0, ambulances.length, ...resourceResult.resources.map((item) => ({ id:item.id, name:item.name, organizationId:item.organization_id,
      number:item.call_sign || item.registration || '—', crew:0, distance:0, eta:0,
      status:item.status === 'available' ? 'Disponible' : item.status === 'maintenance' ? 'Maintenance' : 'En mission',
      lat:Number(item.latitude || 0), lng:Number(item.longitude || 0) })));
  }
  const active = state.interventions.find((item) => !['completed','cancelled'].includes(item.status));
  if (active) {
    const unit = ambulances.find((item) => item.id === active.response_unit_id);
    const facility = hospitals.find((item) => item.id === active.hospital_id);
    state.mission = {
      interventionId:active.id, incidentId:active.incident_id, ambulanceId:active.response_unit_id,
      hospitalId:active.hospital_id, progress:{assigned:0,accepted:3,en_route:25,on_scene:55,patient_loaded:65,hospital_requested:70,to_hospital:82,arrived_hospital:96}[active.status] || 0,
      phase:active.status, totalDistance:unit?.distance || 0, speed:0, routeBlocked:false, follow:true, startedAt:new Date(active.assigned_at).getTime()
    };
  } else if (!demoMode) state.mission = null;
}

function updateLastSync() {
  setText("[data-last-sync]", "Synchronisé à l'instant");
}

function toast(title, message) {
  const wrapper = document.createElement("div");
  wrapper.className = "toast";
  wrapper.innerHTML = `<i>✓</i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small></span>`;
  document.querySelector("[data-toast-stack]").append(wrapper);
  window.setTimeout(() => wrapper.remove(), 5200);
}

function openDialog(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}

function metricCard(label, value, note, tone = "blue") {
  return `<article class="module-metric module-metric--${tone}"><small>${label}</small><strong>${value}</strong><span>${note}</span></article>`;
}

function moduleHeader(kicker, title, description, actions = "") {
  return `<section class="module-heading"><div><span class="eyebrow"><i></i>${kicker}</span><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></section>`;
}

function moduleTop(header, metrics = "") {
  return `<div class="module-sticky">${header}${metrics}</div>`;
}

function getMissionData() {
  const mission = state.mission;
  if (!mission) return null;
  const incident = state.incidents.find((item) => item.id === mission.incidentId) || state.interventions.find((item) => item.id === mission.interventionId)?.incident;
  const ambulance = ambulances.find((item) => item.id === mission.ambulanceId);
  const hospital = hospitals.find((item) => item.id === mission.hospitalId);
  if (!incident || !ambulance) return null;
  return {
    mission,
    incident,
    ambulance,
    hospital
  };
}

function interpolatePoint(start, end, ratio, offset = 0) {
  return [
    start[0] + (end[0] - start[0]) * ratio + offset,
    start[1] + (end[1] - start[1]) * ratio - offset * 0.72
  ];
}

function buildGeoRoute(start, end, alternative = false) {
  const deltaLat = end[0] - start[0];
  const deltaLng = end[1] - start[1];
  const curve = Math.min(.0045, Math.max(.0017, Math.hypot(deltaLat, deltaLng) * .13));
  const direction = deltaLng >= 0 ? 1 : -1;
  const offsets = alternative
    ? [0, curve * direction, curve * 1.45 * direction, curve * .85 * direction, 0]
    : [0, curve * .15 * direction, -curve * .35 * direction, curve * .1 * direction, 0];
  return [0, .24, .51, .76, 1].map((ratio, index) => interpolatePoint(start, end, ratio, offsets[index]));
}

function routeEndpoints() {
  const { mission, incident, ambulance, hospital } = getMissionData();
  const headingToHospital = Boolean(hospital)&&["to_hospital","arrived_hospital","completed","Vers l'hôpital","Terminée"].includes(mission.phase);
  return {
    start: headingToHospital ? [incident.lat, incident.lng] : [ambulance.lat, ambulance.lng],
    end: headingToHospital ? [hospital.lat, hospital.lng] : [incident.lat, incident.lng]
  };
}

function currentGeoRoute() {
  const { start, end } = routeEndpoints();
  return buildGeoRoute(start, end, state.mission.routeBlocked);
}

function primaryGeoRoute() {
  const { start, end } = routeEndpoints();
  return buildGeoRoute(start, end, false);
}

async function fetchRoadRoute(alternative = false) {
  const { start, end } = routeEndpoints();
  const points = [start];
  if (alternative) {
    const direction = end[1] >= start[1] ? 1 : -1;
    points.push(interpolatePoint(start, end, .52, .006 * direction));
  }
  points.push(end);
  const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Routing ${response.status}`);
  const payload = await response.json();
  const route = payload.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(route) || route.length < 2) throw new Error("Itinéraire indisponible");
  return route.map(([lng, lat]) => [lat, lng]);
}

function pointAtProgress(route, progress) {
  const bounded = Math.max(0, Math.min(100, progress));
  const scaled = (bounded / 100) * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = route[index];
  const to = route[index + 1];
  return [
    from[0] + (to[0] - from[0]) * local,
    from[1] + (to[1] - from[1]) * local
  ];
}

function splitRouteAtProgress(route, progress) {
  const point = pointAtProgress(route, progress);
  const scaled = (Math.max(0, Math.min(100, progress)) / 100) * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  return {
    travelled: [...route.slice(0, index + 1), point],
    remaining: [point, ...route.slice(index + 1)],
    point,
    next: route[Math.min(route.length - 1, index + 1)]
  };
}

function routeBearing(from, to) {
  const lat1 = from[0] * Math.PI / 180;
  const lat2 = to[0] * Math.PI / 180;
  const deltaLng = (to[1] - from[1]) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function ambulanceIconMarkup(name) {
  return `<div class="ambulance-map-marker" style="--heading:0deg">
    <span class="vehicle-rotor"><i></i><svg viewBox="0 0 62 34" aria-hidden="true"><path d="M4 9h34l8 7h9c2 0 3 2 3 4v8H4z"/><path class="cab" d="M38 10v10h18l-10-10z"/><path class="cross" d="M18 12h5v-5h5v5h5v5h-5v5h-5v-5h-5z"/><circle cx="16" cy="28" r="5"/><circle cx="48" cy="28" r="5"/></svg></span>
    <b>${escapeHtml(name)}</b>
  </div>`;
}

function hospitalIconMarkup(hospital, recommended) {
  return `<div class="hospital-map-marker ${recommended ? "is-recommended" : ""}"><span>✚</span><b>${escapeHtml(hospital.name)}</b><small>${hospital.beds} places · ${hospital.eta} min</small></div>`;
}

function destroyOperationalMaps() {
  operationalMaps.forEach(({ map }) => map.remove());
  operationalMaps = [];
}

function initOperationalMaps() {
  const hosts = [...document.querySelectorAll("[data-operational-map]")];
  if (!hosts.length || !window.L) return;
  const missionData = getMissionData();
  if (!missionData) return;
  const { mission, incident, ambulance, hospital } = missionData;
  const route = currentGeoRoute();
  const normalRoute = primaryGeoRoute();
  const split = splitRouteAtProgress(route, mission.progress);

  hosts.forEach((host) => {
    const map = L.map(host, { zoomControl: true, attributionControl: true, preferCanvas: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.polyline(route, { color: "#05131d", weight: 12, opacity: .72, lineCap: "round" }).addTo(map);
    let normalLayer = null;
    if (mission.routeBlocked) {
      normalLayer = L.polyline(normalRoute, { color: "#ff3c4d", weight: 7, opacity: .9, dashArray: "8 9" }).addTo(map);
      const blockedPoint = normalRoute[2];
      L.marker(blockedPoint, {
        icon: L.divIcon({ className: "blocked-map-icon", html: "<span>×</span><b>Axe bloqué</b>", iconSize: [92, 34], iconAnchor: [17, 17] })
      }).addTo(map);
    }
    const travelledLayer = L.polyline(split.travelled, { color: "#258cff", weight: 7, opacity: 1, lineCap: "round" }).addTo(map);
    const remainingLayer = L.polyline(split.remaining, { color: mission.routeBlocked ? "#32d782" : "#f33645", weight: 7, opacity: 1, lineCap: "round" }).addTo(map);

    const ambulanceMarker = L.marker(split.point, {
      zIndexOffset: 900,
      icon: L.divIcon({
        className: "ambulance-leaflet-icon",
        html: ambulanceIconMarkup(ambulance.name),
        iconSize: [78, 58],
        iconAnchor: [39, 25]
      })
    }).addTo(map);
    const incidentMarker = L.marker([incident.lat, incident.lng], {
      zIndexOffset: 700,
      icon: L.divIcon({ className: "incident-leaflet-icon", html: `<div><span>!</span><b>Incident</b><small>${escapeHtml(incident.place || "Position GPS")}</small></div>`, iconSize: [128, 54], iconAnchor: [18, 45] })
    }).addTo(map);
    const hospitalMarkers = hospitals.map((item) => L.marker([item.lat, item.lng], {
      zIndexOffset: item.id === hospital?.id ? 650 : 300,
      icon: L.divIcon({
        className: "hospital-leaflet-icon",
        html: hospitalIconMarkup(item, item.id === hospital?.id),
        iconSize: [138, 62],
        iconAnchor: [18, 45]
      })
    }).bindPopup(`<strong>${escapeHtml(item.name)}</strong><br>${item.beds} places disponibles<br>${escapeHtml(item.specialty)}`).addTo(map));

    map.fitBounds(L.latLngBounds([...route, ...hospitals.map((item) => [item.lat, item.lng])]), { padding: [58, 58], maxZoom: 14 });
    map.on("dragstart zoomstart", () => {
      state.mission.follow = false;
      document.querySelectorAll('[data-action="toggle-follow"]').forEach((button) => { button.textContent = "○ Suivre l'ambulance"; });
    });
    const mapEntry = { map, route, normalLayer, travelledLayer, remainingLayer, ambulanceMarker, incidentMarker, hospitalMarkers };
    operationalMaps.push(mapEntry);
    Promise.all([
      fetchRoadRoute(mission.routeBlocked),
      mission.routeBlocked ? fetchRoadRoute(false) : Promise.resolve(null)
    ]).then(([roadRoute, normalRoadRoute]) => {
      if (!operationalMaps.includes(mapEntry)) return;
      mapEntry.route = roadRoute;
      const roadSplit = splitRouteAtProgress(roadRoute, mission.progress);
      travelledLayer.setLatLngs(roadSplit.travelled);
      remainingLayer.setLatLngs(roadSplit.remaining);
      ambulanceMarker.setLatLng(roadSplit.point);
      if (normalLayer && normalRoadRoute) normalLayer.setLatLngs(normalRoadRoute);
      map.fitBounds(L.latLngBounds([...roadRoute, ...hospitals.map((item) => [item.lat, item.lng])]), { padding: [58, 58], maxZoom: 14 });
      updateLiveMissionElements();
    }).catch(() => {
      host.dataset.routeSource = "fallback";
    });
    window.setTimeout(() => map.invalidateSize(), 30);
  });
}

function liveMapMarkup({ compact = false } = {}) {
  const missionData = getMissionData();
  if (!missionData) return '<div class="empty-state"><strong>Aucune mission cartographiable</strong><p>Affectez une ressource pour démarrer le suivi GPS.</p></div>';
  const { mission, incident, ambulance, hospital } = missionData;
  const distance = Math.max(0, mission.totalDistance * (1 - mission.progress / 100));
  const eta = Math.max(0, Math.ceil((distance / Math.max(mission.speed, 10)) * 60));
  return `
    <div class="operational-map ${compact ? "operational-map--compact" : ""}">
      <div class="leaflet-host" data-operational-map aria-label="Carte interactive de suivi opérationnel"></div>
      <div class="fog-map-badge"><i></i><span><strong>${demoMode ? 'FOG-LOMÉ-01' : 'LOTISEC · OSRM'}</strong><small>${demoMode ? (mission.routeBlocked ? "Itinéraire recalculé · 27 ms" : "Décision locale · 24 ms") : 'Routage sans donnée trafic temps réel'}</small></span></div>
      <div class="map-decision-flow">
        <span><i>🚑</i><b>${escapeHtml(ambulance.name)}</b><small>Ambulance affectée</small></span><em>→</em>
        <span><i>!</i><b>${escapeHtml(incident?.place || "Incident")}</b><small>Lieu d'intervention</small></span><em>→</em>
        ${hospital?`<span class="is-recommended"><i>✚</i><b>${escapeHtml(hospital.name)}</b><small>Cible hospitalière · ${hospital.eta} min</small></span>`:'<span><i>✚</i><b>Hôpital à déterminer</b><small>Après prise en charge</small></span>'}
      </div>
      <div class="route-decision-banner ${mission.routeBlocked ? "is-alert" : ""}">
        <strong>${demoMode ? (mission.routeBlocked ? "CONGESTION DÉTECTÉE AVANT DÉPART" : "VOIE RETENUE PAR LE FOG") : 'ITINÉRAIRE ROUTIER OSRM'}</strong>
        <span>${demoMode ? (mission.routeBlocked ? "Axe rouge évité · déviation verte fluide calculée avant le déplacement" : "Trafic fluide : trajet direct le plus rapide") : 'Aucune donnée de congestion temps réel n’est déclarée.'}</span>
      </div>
      <div class="mission-hud">
        <small>MISSION ACTIVE · ${escapeHtml(mission.phase)}</small>
        <strong>${escapeHtml(ambulance.name)} → ${escapeHtml(hospital&&["to_hospital","arrived_hospital","completed","Vers l'hôpital","Terminée"].includes(mission.phase) ? hospital.name : (incident?.place || "position GPS"))}</strong>
        <div><span><b data-live-eta>${eta}</b> min</span><span><b data-live-distance>${distance.toFixed(1)}</b> km</span><span><b data-live-speed>${mission.speed}</b> km/h</span></div>
        <progress data-live-progress max="100" value="${mission.progress}"></progress>
      </div>
      <div class="map-legend">
        <span><i class="legend-blue"></i>Parcouru</span>
        ${mission.routeBlocked
          ? '<span><i class="legend-red legend-dashed"></i>Axe congestionné</span><span><i class="legend-green"></i>Déviation fluide</span>'
          : '<span><i class="legend-red"></i>Itinéraire restant</span><span><i class="legend-green"></i>Hôpital recommandé</span>'}
      </div>
    </div>`;
}

function renderDashboard() {
  const active = state.incidents.filter((item) => item.status !== "rejected");
  const missionData = getMissionData();
  if (!missionData) return `${moduleTop(moduleHeader("Vue opérationnelle", "Tableau de bord", "Données réelles issues du backend LOTISEC."), `<section class="module-metrics">${metricCard("Incidents actifs",active.length,"Données réelles","red")}${metricCard("Unités disponibles",ambulances.filter((item)=>item.status==="Disponible").length,`Sur ${ambulances.length} unités`,"blue")}${metricCard("Places hospitalières",hospitals.reduce((sum,item)=>sum+item.beds,0),"Capacités déclarées","green")}${metricCard("Interventions",state.interventions.length,"Périmètre autorisé","orange")}</section>`)}<section class="module-card"><h2>Aucune mission active</h2><p>Affectez une unité à un incident pour démarrer le suivi.</p></section>`;
  const { ambulance, mission } = missionData;
  return `
    ${moduleTop(moduleHeader("Vue opérationnelle", "Tableau de bord", "Situation réelle des incidents, moyens engagés et capacités hospitalières."), `<section class="module-metrics">
      ${metricCard("Incidents actifs", active.length, "Données chargées", "red")}
      ${metricCard("Ambulances disponibles", ambulances.filter((item) => item.status === "Disponible").length, `Sur ${ambulances.length} véhicules`, "blue")}
      ${metricCard("Places hospitalières", hospitals.reduce((sum, item) => sum + item.beds, 0), "Mises à jour par les hôpitaux", "green")}
      ${metricCard("Interventions", state.interventions.length, "Périmètre autorisé", "orange")}
    </section>`)}
    <section class="module-grid module-grid--dashboard">
      <article class="module-card map-module-card"><header><div><small>SUIVI DE MISSION</small><h2>${escapeHtml(ambulance.name)} · ${escapeHtml(mission.phase)}</h2></div><button data-action="go-module" data-target="Carte en direct">Plein écran ↗</button></header>${liveMapMarkup({ compact: true })}</article>
      <article class="module-card"><header><div><small>FILE PRIORITAIRE</small><h2>Incidents récents</h2></div><button data-action="go-module" data-target="Incidents">Voir tout</button></header>
        <div class="compact-list">${state.incidents.slice(0, 5).map((incident) => `<button data-action="open-incident" data-id="${incident.id}"><i class="severity-${incident.severity}"></i><span><strong>${escapeHtml(incident.type)}</strong><small>${escapeHtml(incident.place || "GPS uniquement")}</small></span><em>${incident.score}</em></button>`).join("")}</div>
      </article>
    </section>`;
}

function renderAmbulances() {
  if (!ambulances.length) return `${moduleTop(moduleHeader("Ressources", "Ambulances", "Unités accessibles selon votre organisation."))}<section class="module-card"><p>Aucune unité de réponse enregistrée.</p></section>`;
  return `
    ${moduleTop(moduleHeader("Flotte connectée", "Ambulances", "Disponibilité, coordonnées d'urgence, position GPS et affectation des moyens.",
      '<button class="button button-secondary" data-action="go-module" data-target="Carte en direct">⌖ Carte de la flotte</button>'), `<section class="module-metrics">
      ${metricCard("Disponibles", ambulances.filter((item) => item.status === "Disponible").length, "Prêtes à être affectées", "green")}
      ${metricCard("En mission", ambulances.filter((item) => item.status === "En mission").length, "Suivi GPS actif", "blue")}
      ${metricCard("Maintenance", ambulances.filter((item) => item.status === "Maintenance").length, "Unités indisponibles", "orange")}
      ${metricCard("Positions connues", ambulances.filter((item) => item.lat && item.lng).length, "Coordonnées enregistrées", "green")}
    </section>`)}
    <section class="fleet-grid">${ambulances.map((item) => `
      <article class="resource-card">
        <header><span class="resource-icon">🚑</span><div><small>${item.id}</small><h2>${escapeHtml(item.name)}</h2></div><em class="resource-status resource-status--${item.status === "Disponible" ? "ok" : item.status === "En mission" ? "busy" : "off"}">${item.status}</em></header>
        <div class="resource-facts"><span><small>Numéro d'urgence</small><strong>${item.number}</strong></span><span><small>Équipage</small><strong>${item.crew} pers.</strong></span><span><small>Distance estimée</small><strong>${item.distance} km</strong></span><span><small>ETA</small><strong>${item.eta} min</strong></span></div>
        <div class="resource-actions"><button data-action="view-ambulance" data-id="${item.id}">Voir sur la carte</button><button ${item.status === "Maintenance" ? "disabled" : ""} data-action="assign-ambulance" data-id="${item.id}">Affecter</button></div>
      </article>`).join("")}</section>
    <section class="module-card"><header><div><small>RÉPONDANTS HISTORIQUES</small><h2>Responders synchronisés</h2></div></header><div class="compact-list">${state.responders.map((item)=>`<span><strong>${escapeHtml(item.name || item.nom || item.id)}</strong><em>${item.disponible ? 'Disponible' : 'Indisponible'}${item.score != null ? ` · score ${item.score}` : ''}</em></span>`).join('') || '<p>Aucun responder historique.</p>'}</div></section>`;
}

function renderHospitals() {
  if (!hospitals.length) return `${moduleTop(moduleHeader("Portail hospitalier", "Hôpitaux", "Établissements et capacités déclarées."))}<section class="module-card"><p>Aucun établissement hospitalier enregistré.</p></section>`;
  const admissionMarkup = `<section class="module-card"><header><div><small>ADMISSIONS</small><h2>Demandes d’accueil</h2></div></header><div class="compact-list">${state.admissions.map((item)=>`<div class="notification-row"><span><strong>${escapeHtml(item.hospital_name || 'Hôpital')}</strong><small>Incident ${escapeHtml(item.incident_id)} · ${escapeHtml(item.status)}</small></span>${item.status==='pending' ? `<span><button data-action="admission-status" data-id="${item.id}" data-status="accepted">Accepter</button><button data-action="admission-status" data-id="${item.id}" data-status="rejected">Refuser</button></span>` : ''}</div>`).join('') || '<p>Aucune demande d’admission.</p>'}</div></section>`;
  const agentsMarkup = canPermission('organization:members') ? `<section class="module-card"><header><div><small>ÉQUIPE</small><h2>Agents de l’établissement</h2></div><button data-action="create-hospital-agent">Créer un agent</button></header><div class="compact-list">${state.organizationMembers.map((item)=>`<div class="notification-row"><span><strong>${escapeHtml(`${item.first_name||''} ${item.last_name||''}`.trim()||item.phone)}</strong><small>${escapeHtml(item.phone)} · ${(item.roles||[]).map(escapeHtml).join(', ')}</small></span>${item.id!==session.user.id?`<button data-action="deactivate-member" data-id="${item.id}">Désactiver</button>`:''}</div>`).join('')||'<p>Aucun agent.</p>'}</div></section>` : '';
  return `
    ${moduleTop(moduleHeader("Portail hospitalier synchronisé", "Hôpitaux", "Capacité d'accueil déclarée en temps réel et recommandations géodécisionnelles."), `<section class="module-metrics">
      ${metricCard("Places disponibles", hospitals.reduce((sum, item) => sum + item.beds, 0), "Toutes spécialités", "green")}
      ${metricCard("Établissements connectés", hospitals.length, "Synchronisation active", "blue")}
      ${metricCard("Occupation moyenne", `${Math.round(hospitals.reduce((sum, item) => sum + item.occupancy, 0) / hospitals.length)}%`, "Capacité déclarée", "orange")}
      ${metricCard("Admissions en attente", state.admissions.filter((item) => item.status === 'pending').length, "Demandes réelles", "green")}
    </section>`)}
    <section class="hospital-grid">${hospitals.map((item, index) => `
      <article class="resource-card hospital-card ${index === 0 ? "is-recommended" : ""}">
        <header><span class="resource-icon resource-icon--hospital">H</span><div><small>${index === 0 ? "RECOMMANDÉ PAR LE FOG" : item.id}</small><h2>${escapeHtml(item.name)}</h2></div><em class="resource-status resource-status--ok">${item.beds} places</em></header>
        <div class="capacity"><span style="width:${item.occupancy}%"></span></div>
        <div class="resource-facts"><span><small>Occupation</small><strong>${item.occupancy}%</strong></span><span><small>Spécialité</small><strong>${item.specialty}</strong></span><span><small>Distance</small><strong>${item.distance} km</strong></span><span><small>ETA</small><strong>${item.eta} min</strong></span></div>
        <div class="resource-actions"><button data-action="hospital-details" data-id="${item.id}">Voir l'hôpital</button>${canPermission('facilities:manage') ? `<button data-action="add-bed" data-id="${item.id}">＋ Mettre à jour les places</button>` : ''}</div>
      </article>`).join("")}</section>${admissionMarkup}${agentsMarkup}`;
}

function renderMapPage() {
  const missionData = getMissionData();
  if (!missionData) return `${moduleTop(moduleHeader("Géodécision", "Carte en direct", "Aucune intervention active avec ressource affectée."))}<section class="module-card"><p>La carte apparaîtra après l’affectation d’une unité.</p></section>`;
  const { mission, hospital } = missionData;
  return `
    ${moduleTop(moduleHeader("Géodécision en temps réel", "Carte en direct", "Position GPS de l'incident, ambulance affectée, trafic, itinéraire restant et hôpitaux proches.",
      `<button class="button button-secondary" data-action="toggle-follow">${mission.follow ? "◉ Caméra active" : "○ Suivre l'ambulance"}</button><button class="button button-primary" data-action="open-google-maps">Ouvrir dans Google Maps ↗</button>`))}
    <section class="map-page-layout">
      <article class="module-card map-module-card map-module-card--large">${liveMapMarkup()}</article>
      <aside class="map-side-panel">
        <article class="module-card"><header><div><small>HÔPITAUX PROCHES</small><h2>Orientation proposée</h2></div></header>
          <div class="nearby-list">${hospitals.slice(0, 3).map((item) => `<button data-action="hospital-details" data-id="${item.id}" class="${item.id === hospital?.id ? "is-selected" : ""}"><span><strong>${item.name}</strong><small>${item.beds} places · ${item.occupancy}% occupé</small></span><em>${item.distance} km<br>${item.eta} min</em></button>`).join("")||'<p>Aucun établissement déclaré.</p>'}</div>
        </article>
        ${demoMode ? `<article class="module-card"><header><div><small>TRAFIC · DÉMONSTRATION</small><h2>Axes simulés</h2></div></header>
          <div class="traffic-mini">${trafficSegments.map((item) => `<span><i class="traffic-${item.level.toLowerCase()}"></i><b>${item.name}</b><em>${item.speed} km/h</em></span>`).join("")}</div>
          <button class="button button-danger button-full" data-action="toggle-block">${mission.routeBlocked ? "Rétablir l'axe et recalculer" : "Simuler la congestion avant départ"}</button>
        </article>` : '<article class="module-card"><header><div><small>TRAFIC</small><h2>Non connecté</h2></div></header><p>Aucun fournisseur de trafic temps réel n’est configuré.</p></article>'}
      </aside>
    </section>`;
}

function renderTraffic() {
  if (!demoMode) return `${moduleTop(moduleHeader("Donnée externe", "Trafic", "Aucun fournisseur de trafic temps réel n’est connecté."))}<section class="module-card"><p>OSRM fournit le routage, mais pas l’état réel du trafic. Les simulations sont désactivées en production.</p></section>`;
  const { mission } = getMissionData();
  return `
    ${moduleTop(moduleHeader("Analyse routière", "Trafic en temps réel", "Le Fog compare les vitesses des axes et recalcule l'itinéraire lorsqu'une congestion apparaît.",
      `<button class="button button-primary" data-action="toggle-block">${mission.routeBlocked ? "Rétablir la voie directe" : "Simuler avant départ"}</button>`))}
    <section class="module-grid module-grid--traffic">
      <article class="module-card map-module-card">${liveMapMarkup({ compact: true })}</article>
      <article class="module-card"><header><div><small>SEGMENTS SURVEILLÉS</small><h2>Conditions de circulation</h2></div></header>
        <div class="traffic-list">${trafficSegments.map((item) => `<div><i class="traffic-${item.level.toLowerCase()}"></i><span><strong>${item.name}</strong><small>${item.level}</small></span><b>${item.speed} km/h</b><button data-action="cycle-traffic" data-id="${item.id}">Modifier</button></div>`).join("")}</div>
      </article>
    </section>`;
}

function renderInterventions() {
  const missionData = getMissionData();
  if (!missionData) return `${moduleTop(moduleHeader("Suivi des missions", "Interventions", "Interventions accessibles selon votre rôle et votre organisation."), `<section class="module-metrics">${metricCard("Total",state.interventions.length,"Chargées depuis l’API","blue")}${metricCard("Terminées",state.interventions.filter((item)=>item.status==='completed').length,"Historique réel","green")}</section>`)}<section class="module-card"><p>Aucune intervention active.</p></section>`;
  const { mission, incident, ambulance, hospital } = missionData;
  const phases = ['assigned','accepted','en_route','on_scene','patient_loaded','hospital_requested','to_hospital','arrived_hospital','completed'];
  const phaseLabels = {assigned:'Affectée',accepted:'Acceptée',en_route:'En route',on_scene:'Sur place',patient_loaded:'Patient pris en charge',hospital_requested:'Admission demandée',to_hospital:"Vers l’hôpital",arrived_hospital:'Arrivée hôpital',completed:'Terminée'};
  const activeIndex = Math.max(0, phases.indexOf(mission.phase));
  return `
    ${moduleTop(moduleHeader("Suivi des missions", "Interventions", "Synchronisation de l'affectation jusqu'à la prise en charge hospitalière.",
      '<button class="button button-secondary" data-action="go-module" data-target="Carte en direct">⌖ Ouvrir la carte live</button>'), `<section class="module-metrics">
      ${metricCard("Affectées", state.interventions.filter((item)=>item.status==='assigned').length, "Données réelles", "blue")}
      ${metricCard("En route", ["En route", "Vers l'hôpital"].includes(mission.phase) ? 1 : 0, `${ambulance.name}`, "orange")}
      ${metricCard("Sur place", mission.phase === "Sur place" ? 1 : 0, "Équipe engagée", "green")}
      ${metricCard("Terminées", state.interventions.filter((item)=>item.status==='completed').length, "Historique chargé", "green")}
    </section>`)}
    <section class="module-grid module-grid--intervention">
      <article class="module-card intervention-detail">
        <header><div><small>${incident?.id}</small><h2>${escapeHtml(incident?.type || "Incident")}</h2></div><em class="resource-status resource-status--busy">${mission.phase}</em></header>
        <p>⌖ ${escapeHtml(incident?.place || "Position GPS reçue")}</p>
        <div class="assignment-banner"><span>🚑</span><div><small>MOYEN AFFECTÉ</small><strong>${escapeHtml(ambulance.name)}</strong><em>${ambulance.number}</em></div><div><small>HÔPITAL CIBLE</small><strong>${escapeHtml(hospital?.name || 'Non sélectionné')}</strong><em>${hospital ? `${hospital.beds} places disponibles` : 'Admission à demander'}</em></div></div>
        <div class="phase-track">${phases.map((phase, index) => `<span class="${index < activeIndex ? "is-done" : index === activeIndex ? "is-active" : ""}"><i>${index < activeIndex ? "✓" : index + 1}</i><b>${phaseLabels[phase]}</b></span>`).join("")}</div>
        <div class="resource-actions"><button data-action="advance-mission">Passer au statut suivant</button>${['on_scene','patient_loaded'].includes(mission.phase) ? '<button data-action="request-admission">Demander un hôpital</button>' : ''}<button data-action="go-module" data-target="Carte en direct">Afficher le détail sur la carte</button></div>
      </article>
      <article class="module-card map-module-card">${liveMapMarkup({ compact: true })}</article>
    </section>`;
}

function renderStatistics() {
  if (!demoMode && canPermission('admissions:organization') && !canPermission('incidents:read')) {
    const pending=state.admissions.filter((item)=>item.status==='pending').length;
    const accepted=state.admissions.filter((item)=>['accepted','arrived','closed'].includes(item.status)).length;
    const own=hospitals.find((item)=>item.id===session.user.organizationId);
    return `${moduleTop(moduleHeader("Indicateurs hospitaliers", "Statistiques", "Données limitées à votre établissement."),`<section class="module-metrics">${metricCard("Demandes",state.admissions.length,"Périmètre hospitalier","blue")}${metricCard("En attente",pending,"À traiter","orange")}${metricCard("Acceptées",accepted,"Admissions suivies","green")}${metricCard("Places",own?.beds||0,"Capacité déclarée","green")}</section>`)}<section class="module-card"><p>Ces indicateurs sont calculés uniquement à partir des admissions et capacités autorisées pour votre organisation.</p></section>`;
  }
  if (!demoMode) {
    const total = state.incidents.length;
    const critical = state.incidents.filter((item) => item.severity === 'critical').length;
    const completed = state.interventions.filter((item) => item.status === 'completed').length;
    const sources = Object.entries(state.incidents.reduce((acc,item)=>{acc[item.source]=(acc[item.source]||0)+1;return acc;},{}));
    return `${moduleTop(moduleHeader("Indicateurs réels", "Statistiques", "Synthèse des données actuellement chargées depuis LOTISEC."), `<section class="module-metrics">${metricCard("Incidents",total,"Périmètre chargé","red")}${metricCard("Critiques",critical,"Sévérité déclarée","orange")}${metricCard("Interventions",state.interventions.length,"Périmètre autorisé","blue")}${metricCard("Terminées",completed,"Historique réel","green")}</section>`)}<section class="module-card"><header><div><small>SOURCES</small><h2>Origine des incidents</h2></div></header><div class="compact-list">${sources.map(([source,count])=>`<span><strong>${escapeHtml(source)}</strong><em>${count}</em></span>`).join('') || '<p>Aucune donnée.</p>'}</div></section><section class="module-card"><header><div><small>ACCIDENTOLOGIE HISTORIQUE</small><h2>Données géographiques protégées</h2></div></header><div class="compact-list"><span><strong>Événements sur 30 jours</strong><em>${state.accidentStats?.total ?? state.accidentGeojson.features.length}</em></span>${(state.accidentStats?.by_severity||[]).map((item)=>`<span><strong>${escapeHtml(item.severity||'unknown')}</strong><em>${item.count}</em></span>`).join('')}</div></section>`;
  }
  const bars = [42, 58, 36, 75, 66, 91, 72];
  return `
    ${moduleTop(moduleHeader("Aide à la décision", "Statistiques", "Indicateurs consolidés des signalements, délais et interventions.",
      '<button class="button button-secondary" data-action="export-stats">Exporter CSV</button><button class="button button-primary" data-action="download-report">⇩ Télécharger le rapport</button>'), `<section class="module-metrics">
      ${metricCard("Incidents aujourd'hui", 23, "+27% sur 7 jours", "red")}
      ${metricCard("Temps moyen d'arrivée", "06:42", "Objectif < 8 min", "green")}
      ${metricCard("Incidents critiques", 7, "30% des alertes", "orange")}
      ${metricCard("Taux de réussite", "98%", "+3 points", "green")}
    </section>`)}
    <section class="module-grid statistics-grid">
      <article class="module-card chart-card"><header><div><small>7 DERNIERS JOURS</small><h2>Volume d'interventions</h2></div></header><div class="bar-chart">${bars.map((value, index) => `<span><i style="height:${value}%"></i><b>${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][index]}</b><em>${Math.round(value / 4)}</em></span>`).join("")}</div></article>
      <article class="module-card"><header><div><small>RÉPARTITION</small><h2>Nature des incidents</h2></div></header>
        <div class="stat-lines"><span><b>Accidents de la route</b><i><em style="width:68%"></em></i><strong>68%</strong></span><span><b>Malaises</b><i><em style="width:18%"></em></i><strong>18%</strong></span><span><b>Incendies</b><i><em style="width:9%"></em></i><strong>9%</strong></span><span><b>Autres</b><i><em style="width:5%"></em></i><strong>5%</strong></span></div>
      </article>
      <article class="module-card performance-card"><header><div><small>CHAÎNE OPÉRATIONNELLE</small><h2>Temps moyen par étape</h2></div><em class="resource-status resource-status--ok">Objectif atteint</em></header>
        <div class="performance-steps"><span><i>01</i><b>Réception SOS</b><strong>00:31</strong></span><span><i>02</i><b>Décision Fog</b><strong>00:00.024</strong></span><span><i>03</i><b>Affectation</b><strong>01:08</strong></span><span><i>04</i><b>Arrivée sur place</b><strong>06:42</strong></span></div>
      </article>
      <article class="module-card insight-card"><header><div><small>ANALYSE LOTISEC</small><h2>Points de décision</h2></div></header>
        <div class="decision-insights"><span class="is-positive"><i>↓</i><div><strong>−18 % sur le délai moyen</strong><small>Le choix de l'ambulance la plus proche réduit le temps d'approche.</small></div></span><span><i>↗</i><div><strong>7 réorientations Fog</strong><small>Des congestions ont déclenché un recalcul automatique cette semaine.</small></div></span><span class="is-positive"><i>✓</i><div><strong>92 % de pertinence</strong><small>Concordance ambulance–hôpital sur les missions évaluées.</small></div></span></div>
      </article>
    </section>`;
}

function renderFog() {
  if (!demoMode) return `${moduleTop(moduleHeader("Traitement", "Fog Computing", "Aucun nœud Fog physique n’est connecté à cet environnement."))}<section class="module-card"><p>La priorisation serveur est active. Les métriques de latence Fog de la maquette sont désactivées en production.</p></section>`;
  const { mission } = getMissionData();
  return `
    ${moduleTop(moduleHeader("Traitement distribué", "Fog Computing", "Le nœud local rapproche incident, ambulance, trafic et hôpital avant synchronisation avec le Cloud.",
      '<button class="button button-primary" data-action="fog-recalculate">Relancer la géodécision</button>'))}
    <section class="fog-architecture">
      <article class="fog-node"><i></i><small>NŒUD ACTIF</small><h2>FOG-LOMÉ-01</h2><strong>24 ms</strong><span>Latence de traitement</span></article>
      <div class="fog-pipeline">
        <span class="is-done"><i>1</i><b>Ingestion GPS</b><em>8 ms</em></span><span class="is-done"><i>2</i><b>Analyse trafic</b><em>6 ms</em></span><span class="is-done"><i>3</i><b>Disponibilités</b><em>4 ms</em></span><span class="is-active"><i>4</i><b>Géodécision</b><em>6 ms</em></span>
      </div>
      <article class="fog-decision"><small>DÉCISION LOCALE</small><h2>Secours Abalo recommandé</h2><div><span>Distance<strong>2,4 km</strong></span><span>ETA<strong>${mission.routeBlocked ? "8 min" : "6 min"}</strong></span><span>Hôpital<strong>CHU SO</strong></span></div><em><i></i> Synchronisé avec le Cloud</em></article>
    </section>
    <section class="module-grid">
      <article class="module-card"><header><div><small>JOURNAL DE DÉCISION</small><h2>Derniers traitements</h2></div></header><div class="decision-log"><span><time>14:35:22</time><b>Itinéraire optimal calculé</b><em>24 ms</em></span><span><time>14:35:18</time><b>Capacité CHU SO mise à jour</b><em>18 ms</em></span><span><time>14:35:10</time><b>Signalement mobile priorisé</b><em>31 ms</em></span></div></article>
      <article class="module-card"><header><div><small>RÉSILIENCE</small><h2>État Fog–Cloud</h2></div></header><div class="health-list"><span><i></i>Cache local opérationnel<b>98%</b></span><span><i></i>File de synchronisation<b>0 attente</b></span><span><i></i>GPS ambulances<b>4/4</b></span><span><i></i>Données trafic<b>À jour</b></span></div></article>
    </section>`;
}

function renderNotifications() {
  return `
    ${moduleTop(moduleHeader("Centre d'alertes", "Notifications", "Événements opérationnels nécessitant l'attention de l'opérateur.",
      '<button class="button button-secondary" data-action="mark-all-read">Tout marquer comme lu</button>'))}
    <section class="module-card notification-panel">${state.notifications.map((item) => `<button class="notification-row ${item.unread ? "is-unread" : ""}" data-action="read-notification" data-id="${item.id}"><i></i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></span><time>${item.createdAt ? new Date(item.createdAt).toLocaleString('fr-FR') : ''}</time></button>`).join("") || '<p>Aucune notification.</p>'}</section>`;
}

function renderAudit() {
  return `${moduleTop(moduleHeader("Traçabilité", "Journal d’audit", "Opérations sensibles enregistrées par le backend."))}<section class="module-card"><div class="compact-list">${state.auditLogs.map((item)=>`<div class="notification-row"><span><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.entity_type || '')} ${escapeHtml(item.entity_id || '')}</small></span><time>${new Date(item.created_at).toLocaleString('fr-FR')}</time></div>`).join('') || '<p>Aucune opération auditée.</p>'}</div></section>`;
}

function renderSettings() {
  const theme = document.documentElement.dataset.theme;
  return `
    ${moduleTop(moduleHeader("Configuration", "Paramètres", "Préférences de la console, synchronisation mobile et informations d'intégration."))}
    <section class="settings-grid">
      <article class="module-card settings-card"><header><div><small>AFFICHAGE</small><h2>Thème de la console</h2></div></header><p>Les textes, champs, cartes et contrôles restent contrastés dans les deux modes.</p><button class="theme-choice" data-action="toggle-theme"><span>${theme === "dark" ? "☀" : "☾"}</span><strong>Passer en mode ${theme === "dark" ? "clair" : "sombre"}</strong></button></article>
      <article class="module-card settings-card"><header><div><small>APPLICATIONS CLIENTES</small><h2>API de réception</h2></div></header><code>POST /api/v1/incidents</code><p>Canal canonique authentifié pour les SOS mobile, web et opérateur.</p><button data-action="copy-api">Copier l'URL de l'API</button><button data-action="open-citizen">Ouvrir le portail citoyen</button></article>
      <article class="module-card settings-card"><header><div><small>TEMPS RÉEL</small><h2>Synchronisation</h2></div></header><label class="setting-toggle"><span><strong>Réception automatique</strong><small>Supabase Realtime avec repli API toutes les 3 secondes</small></span><input type="checkbox" checked disabled></label><label class="setting-toggle"><span><strong>Priorisation serveur</strong><small>Score opérationnel calculé par le backend</small></span><input type="checkbox" checked disabled></label></article>
      <article class="module-card settings-card"><header><div><small>SÉCURITÉ</small><h2>Contrôle d'accès RBAC</h2></div></header><p>Session JWT, permissions et organisation : ${(session.user.roles || []).map(escapeHtml).join(', ')}.</p><button data-action="test-api">Tester la connexion API</button></article>
    </section>`;
}

function renderUsers() {
  const roles = ['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent','zem_driver','citizen'];
  return `${moduleTop(moduleHeader("Administration RBAC", "Utilisateurs & rôles", "Attribuez des rôles et une organisation aux comptes institutionnels.", '<button class="button button-secondary" data-action="create-user">Créer un compte</button><button class="button button-primary" data-action="create-organization">Créer une organisation</button>'))}
    <section class="module-card"><div class="compact-list">${state.adminUsers.map((user)=>`<div class="notification-row"><span><strong>${escapeHtml(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.phone)}</strong><small>${escapeHtml(user.phone)} · ${(user.roles || []).map((entry)=>escapeHtml(entry.role)).join(', ') || 'aucun rôle'}</small></span><span><button data-action="grant-role" data-id="${user.id}">Attribuer</button>${(user.roles || []).map((entry)=>`<button data-action="revoke-role" data-id="${user.id}" data-role="${escapeHtml(entry.role)}" data-organization-id="${escapeHtml(entry.organization_id || '')}">Retirer ${escapeHtml(entry.role)}</button>`).join('')}</span></div>`).join('') || '<p>Aucun utilisateur disponible.</p>'}</div></section>
    <section class="module-card"><header><div><small>RÉFÉRENTIEL</small><h2>Rôles disponibles</h2></div></header><p>${roles.join(' · ')}</p><p>${state.organizations.length} organisation(s) active(s).</p></section>`;
}

function renderZemApplications() {
  return `${moduleTop(moduleHeader("Contrôle", "Accréditations Zem", "Validation obligatoire avant l’activation du mode conducteur."))}<section class="module-card"><div class="compact-list">${state.zemApplications.map((item)=>`<div class="notification-row"><span><strong>${escapeHtml(`${item.first_name || ''} ${item.last_name || ''}`.trim() || item.phone)}</strong><small>${escapeHtml(item.plate || '')} · ${escapeHtml(item.work_zone || '')} · ${escapeHtml(item.status)}</small></span>${item.status==='pending'?`<span><button data-action="zem-application" data-id="${item.id}" data-status="approved">Approuver</button><button data-action="zem-application" data-id="${item.id}" data-status="rejected">Refuser</button></span>`:''}</div>`).join('') || '<p>Aucune demande Zem.</p>'}</div></section>`;
}

function renderCurrentModule() {
  destroyOperationalMaps();
  if (state.currentModule === "Incidents") {
    elements.incidentPage.hidden = false;
    elements.dynamicPage.hidden = true;
    setText("[data-topbar-title]", "Centre de réception des signalements");
    renderIncidents();
    return;
  }
  const renderers = {
    "Tableau de bord": renderDashboard,
    "Ambulances": renderAmbulances,
    "Hôpitaux": renderHospitals,
    "Carte en direct": renderMapPage,
    "Trafic en temps réel": renderTraffic,
    "Interventions": renderInterventions,
    "Statistiques": renderStatistics,
    "Fog Computing": renderFog,
    "Notifications": renderNotifications,
    "Paramètres": renderSettings,
    "Utilisateurs": renderUsers,
    "Audit": renderAudit,
    "Accréditations Zem": renderZemApplications
  };
  elements.incidentPage.hidden = true;
  elements.dynamicPage.hidden = false;
  elements.dynamicPage.innerHTML = (renderers[state.currentModule] || renderDashboard)();
  setText("[data-topbar-title]", state.currentModule);
  initOperationalMaps();
  updateLiveMissionElements();
}

function switchModule(module) {
  state.currentModule = module;
  document.querySelectorAll("[data-module]").forEach((link) => link.classList.toggle("is-active", link.dataset.module === module));
  document.querySelector("[data-sidebar]")?.classList.remove("is-open");
  const activeLink = [...document.querySelectorAll("[data-module]")].find((link) => link.dataset.module === module);
  if (activeLink) history.replaceState(null, "", activeLink.getAttribute("href"));
  renderCurrentModule();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateLiveMissionElements() {
  const mission = state.mission;
  if (!mission) return;
  const distance = Math.max(0, mission.totalDistance * (1 - mission.progress / 100));
  const eta = Math.max(0, Math.ceil((distance / Math.max(mission.speed, 10)) * 60));
  operationalMaps.forEach((entry) => {
    const route = entry.route || currentGeoRoute();
    const split = splitRouteAtProgress(route, mission.progress);
    const bearing = routeBearing(split.point, split.next);
    entry.route = route;
    entry.travelledLayer.setLatLngs(split.travelled);
    entry.remainingLayer.setLatLngs(split.remaining);
    entry.ambulanceMarker.setLatLng(split.point);
    const rotor = entry.ambulanceMarker.getElement()?.querySelector(".ambulance-map-marker");
    if (rotor) rotor.style.setProperty("--heading", `${bearing - 90}deg`);
    if (mission.follow) entry.map.panTo(split.point, { animate: true, duration: .75 });
  });
  document.querySelectorAll("[data-live-progress]").forEach((element) => { element.value = mission.progress; });
  setText("[data-live-eta]", eta);
  setText("[data-live-distance]", distance.toFixed(1));
  setText("[data-live-speed]", mission.speed);
}

async function advanceMission() {
  if (!state.mission) return;
  const next = {assigned:'accepted',accepted:'en_route',en_route:'on_scene',on_scene:'patient_loaded',to_hospital:'arrived_hospital',arrived_hospital:'completed'}[state.mission.phase];
  if (!next) return toast('Action requise', state.mission.phase === 'patient_loaded' ? 'Demandez une admission hospitalière.' : 'Attendez la réponse de l’hôpital.');
  try {
    await apiFetch(`/api/v1/interventions/${state.mission.interventionId}/status`, { method:'PATCH', body:JSON.stringify({status:next}) });
    await loadOperationalData(); renderCurrentModule(); toast('Statut synchronisé', `Mission : ${next}.`);
  } catch (error) { toast('Transition refusée',error.message); }
}

function toggleRouteBlock() {
  if (!state.mission || !demoMode) return;
  state.mission.routeBlocked = !state.mission.routeBlocked;
  const segment = trafficSegments[2];
  segment.level = state.mission.routeBlocked ? "Bloqué" : "Dense";
  segment.speed = state.mission.routeBlocked ? 0 : 18;
  state.mission.progress = 0;
  state.mission.phase = "En route";
  state.mission.speed = state.mission.routeBlocked ? 29 : 42;
  state.mission.follow = true;
  state.mission.departureHoldUntil = Date.now() + 2200;
  state.mission.startedAt = Date.now();
  const incident = state.incidents.find((item) => item.id === state.mission.incidentId);
  if (incident) incident.status = "enroute";
  saveIncidents();
  toast("Fog Computing", state.mission.routeBlocked
    ? "Congestion identifiée avant le départ : l'axe rouge est évité et la déviation fluide est calculée en 27 ms."
    : "Axe rétabli avant le départ : retour à la voie directe optimale.");
  renderCurrentModule();
}

function openHospital(id) {
  const hospital = hospitals.find((item) => item.id === id);
  if (!hospital) return;
  elements.detailContent.innerHTML = `
    <header class="detail-hero detail-hero--hospital"><span class="detail-source">Portail hospitalier connecté</span><h2>${escapeHtml(hospital.name)}</h2><p>${escapeHtml(hospital.specialty)}</p></header>
    <section class="detail-section"><h3>Informations de l'hôpital</h3><div class="detail-grid"><div class="detail-stat"><small>Adresse</small><strong>${escapeHtml(hospital.address)}</strong></div><div class="detail-stat"><small>Téléphone</small><strong>${escapeHtml(hospital.phone)}</strong></div><div class="detail-stat"><small>Distance</small><strong>${hospital.distance} km</strong></div><div class="detail-stat"><small>ETA</small><strong>${hospital.eta} min</strong></div></div></section>
    <section class="detail-section"><h3>Services disponibles</h3><div class="hospital-services">${hospital.services.map((service) => `<span>✓ ${escapeHtml(service)}</span>`).join("")}</div><p class="detail-description"><strong>Spécialité principale :</strong> ${escapeHtml(hospital.specialty)}. Capacité déclarée : ${hospital.beds} places, occupation ${hospital.occupancy}%.</p></section>
    <section class="detail-actions"><button class="button button-primary" data-open-hospital-map="${hospital.id}">Voir sur la carte</button></section>`;
  elements.detailContent.querySelector("[data-open-hospital-map]")?.addEventListener("click", () => {
    state.mission.hospitalId = hospital.id;
    elements.detail.close();
    switchModule("Carte en direct");
  });
  elements.detail.showModal();
}

function openHospitalCapacity(id) {
  const hospital = hospitals.find((item) => item.id === id);
  if (!hospital) return;
  elements.detailContent.innerHTML = `
    <header class="detail-hero detail-hero--hospital"><span class="detail-source">Mise à jour hospitalière</span><h2>${escapeHtml(hospital.name)}</h2><p>Déclarer la capacité réellement mobilisable</p></header>
    <section class="detail-section"><h3>Places disponibles</h3><p class="detail-description">Cette donnée est transmise immédiatement au moteur de recommandation Fog.</p><div class="bed-editor"><button data-hospital-bed="-1">−</button><strong>${hospital.beds} places</strong><button data-hospital-bed="1">＋</button></div></section>
    <section class="detail-section"><h3>Taux d'occupation</h3><input class="capacity-range" type="range" min="0" max="100" value="${hospital.occupancy}" data-hospital-occupancy><p class="detail-description"><strong data-occupancy-label>${hospital.occupancy}% occupé</strong></p></section>`;
  elements.detailContent.querySelectorAll("[data-hospital-bed]").forEach((button) => button.addEventListener("click", () => {
    hospital.beds = Math.max(0, hospital.beds + Number(button.dataset.hospitalBed));
    syncHospitalCapacity(hospital);
    openHospitalCapacity(hospital.id);
    toast("Capacité mise à jour", `${hospital.name} : ${hospital.beds} place(s) disponible(s).`);
  }));
  elements.detailContent.querySelector("[data-hospital-occupancy]")?.addEventListener("input", (event) => {
    hospital.occupancy = Number(event.target.value);
    setText("[data-occupancy-label]", `${hospital.occupancy}% occupé`);
  });
  elements.detailContent.querySelector("[data-hospital-occupancy]")?.addEventListener("change", () => {
    syncHospitalCapacity(hospital);
    toast("Occupation synchronisée", `${hospital.name} : ${hospital.occupancy}% d'occupation.`);
  });
  elements.detail.showModal();
}

async function syncHospitalCapacity(hospital) {
  const total = Math.max(hospital.beds, Math.round(hospital.beds / Math.max(0.01, 1 - hospital.occupancy / 100)));
  try { await apiFetch(`/api/v1/facilities/${hospital.id}/capacities`, { method:"PUT", body:JSON.stringify({ service:"urgences", available:hospital.beds, total, operational:true }) }); }
  catch (error) { toast("Capacité non synchronisée", error.message); }
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStatisticsCsv() {
  const rows = [
    ["Indicateur", "Valeur", "Évolution"],
    ["Incidents aujourd'hui", "23", "+27% sur 7 jours"],
    ["Temps moyen d'arrivée", "06:42", "Objectif < 8 min"],
    ["Incidents critiques", "7", "30% des alertes"],
    ["Taux de réussite", "98%", "+3 points"],
    ["Réorientations Fog", "7", "Cette semaine"]
  ];
  downloadBlob(`lotisec-statistiques-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
  toast("Export terminé", "Le fichier CSV des indicateurs a été téléchargé.");
}

function downloadStatisticsReport() {
  const report = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Rapport LOTISEC</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:45px auto;color:#123047}h1{color:#174f9c}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px;border:1px solid #cbdde8;text-align:left}th{background:#eaf3fb}.note{padding:16px;border-left:4px solid #2e8cff;background:#f3f8fc}</style><h1>LOTISEC — Rapport opérationnel</h1><p>Édité le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date())}</p><table><tr><th>Indicateur</th><th>Résultat</th><th>Lecture</th></tr><tr><td>Incidents aujourd'hui</td><td>23</td><td>+27 % sur 7 jours</td></tr><tr><td>Temps moyen d'arrivée</td><td>06:42</td><td>Objectif inférieur à 8 min atteint</td></tr><tr><td>Incidents critiques</td><td>7</td><td>30 % des alertes</td></tr><tr><td>Taux de réussite</td><td>98 %</td><td>+3 points</td></tr><tr><td>Recalculs Fog</td><td>7</td><td>Congestions évitées cette semaine</td></tr></table><div class="note"><strong>Synthèse :</strong> le choix du moyen disponible le plus proche et le recalcul local des itinéraires réduisent le délai d'approche observé de 18 % sur le scénario pilote.</div></html>`;
  downloadBlob(`rapport-operationnel-lotisec-${new Date().toISOString().slice(0, 10)}.html`, report, "text/html;charset=utf-8");
  toast("Rapport généré", "Le rapport opérationnel LOTISEC a été téléchargé.");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.textContent = theme === "dark" ? "☀" : "☾";
    toggle.setAttribute("aria-label", `Passer au mode ${theme === "dark" ? "clair" : "sombre"}`);
  }
}

function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  if (state.currentModule === "Paramètres") renderCurrentModule();
  toast("Thème appliqué", `Mode ${document.documentElement.dataset.theme === "dark" ? "sombre" : "clair"} activé.`);
}

document.querySelector("[data-open-manual]")?.addEventListener("click", () => openDialog(elements.manualModal));
document.querySelector("[data-open-mobile]")?.addEventListener("click", () => openDialog(elements.mobileModal));
document.querySelector("[data-close-manual]")?.addEventListener("click", () => elements.manualModal.close());
document.querySelector("[data-close-mobile]")?.addEventListener("click", () => elements.mobileModal.close());
document.querySelector("[data-close-detail]")?.addEventListener("click", () => elements.detail.close());
document.querySelector("[data-theme-toggle]")?.addEventListener("click", toggleTheme);

elements.manualForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const incident = formIncident(elements.manualForm, "manual");
  const saved = await sendMobileIncident(incident);
  if (saved) {
    elements.manualModal.close();
    toast("Incident créé manuellement", "Les données ont été enregistrées dans LOTISEC.");
    openDetail(saved.id);
  }
});

elements.mobileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const incident = formIncident(elements.mobileForm, "mobile");
  elements.mobileModal.close();
  await sendMobileIncident(incident);
});

function refreshMobileGps() {
  const fallback = () => {
    const variations = [[6.2027, 1.1984], [6.1588, 1.2101], [6.1871, 1.1757]];
    const [lat, lng] = variations[Math.floor(Math.random() * variations.length)];
    elements.mobileForm.elements.lat.value = lat;
    elements.mobileForm.elements.lng.value = lng;
    elements.mobileForm.elements.accuracy.value = 8;
    setText("[data-mobile-location-label]", `${lat.toFixed(6)}, ${lng.toFixed(6)} · précision ± 8 m`);
    toast("GPS du mobile détecté", "La position est jointe automatiquement au SOS.");
  };
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = Math.round(position.coords.accuracy);
    elements.mobileForm.elements.lat.value = lat;
    elements.mobileForm.elements.lng.value = lng;
    elements.mobileForm.elements.accuracy.value = accuracy;
    setText("[data-mobile-location-label]", `${lat.toFixed(6)}, ${lng.toFixed(6)} · précision ± ${accuracy} m`);
    toast("GPS du mobile détecté", "La position est jointe automatiquement au SOS.");
  }, fallback, { enableHighAccuracy: true, timeout: 5000 });
}

document.querySelector("[data-refresh-mobile-gps]")?.addEventListener("click", refreshMobileGps);
document.querySelector("[data-use-location]")?.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Géolocalisation indisponible", "Saisissez les coordonnées GPS manuellement.");
  navigator.geolocation.getCurrentPosition((position) => {
    elements.manualForm.elements.lat.value = position.coords.latitude.toFixed(6);
    elements.manualForm.elements.lng.value = position.coords.longitude.toFixed(6);
    toast("Position récupérée", `Précision estimée : ${Math.round(position.coords.accuracy)} mètres.`);
  }, () => toast("Position non autorisée", "Vous pouvez saisir les coordonnées GPS manuellement."), { enableHighAccuracy: true, timeout: 7000 });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderIncidents();
  });
});

document.querySelector("[data-search]")?.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderIncidents();
});

document.querySelector("[data-pause-feed]")?.addEventListener("click", (event) => {
  state.paused = !state.paused;
  event.currentTarget.classList.toggle("is-paused", state.paused);
  event.currentTarget.innerHTML = state.paused ? "<span>▶</span> Reprendre le flux" : "<span>Ⅱ</span> Mettre en pause";
  if (!state.paused && state.queuedEvents.length) {
    const queued = [...state.queuedEvents];
    state.queuedEvents = [];
    queued.reverse().forEach((incident) => ingestIncident(incident));
  }
});

document.querySelector("[data-open-latest]")?.addEventListener("click", () => {
  if (state.latestId) openDetail(state.latestId);
});
document.querySelector("[data-open-notifications]")?.addEventListener("click", () => switchModule("Notifications"));

document.querySelector("[data-open-maps]")?.addEventListener("click", () => {
  const incident = state.incidents.find((item) => item.id === state.selectedId);
  if (incident) window.open(`https://www.google.com/maps?q=${incident.lat},${incident.lng}`, "_blank", "noopener");
});

const emergencyModal = document.querySelector("[data-emergency-modal]");
document.querySelector("[data-emergency]")?.addEventListener("click", () => openDialog(emergencyModal));
document.querySelector("[data-close-emergency]")?.addEventListener("click", () => emergencyModal.close());
document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => document.querySelector("[data-sidebar]")?.classList.toggle("is-open"));

document.querySelectorAll("[data-module]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchModule(link.dataset.module);
  });
});

elements.dynamicPage?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "go-module") switchModule(button.dataset.target);
  if (action === "open-mobile") openDialog(elements.mobileModal);
  if (action === "open-incident") openDetail(button.dataset.id);
  if (action === "view-ambulance") {
    state.mission.ambulanceId = button.dataset.id;
    switchModule("Carte en direct");
    toast("Ambulance localisée", "Sa dernière position GPS est affichée.");
  }
  if (action === "assign-ambulance") {
    const incident = state.incidents.find((item) => ["new", "validated"].includes(item.status)) || state.incidents[0];
    assignMission(incident.id, button.dataset.id);
    switchModule("Interventions");
  }
  if (action === "hospital-details") openHospital(button.dataset.id);
  if (action === "add-bed") openHospitalCapacity(button.dataset.id);
  if (action === "export-stats") exportStatisticsCsv();
  if (action === "download-report") downloadStatisticsReport();
  if (action === "toggle-block" || action === "fog-recalculate") toggleRouteBlock();
  if (action === "toggle-follow") {
    state.mission.follow = !state.mission.follow;
    renderCurrentModule();
    toast("Caméra", state.mission.follow ? "Suivi de l'ambulance activé." : "Carte libre activée.");
  }
  if (action === "open-google-maps") {
    const { incident } = getMissionData();
    window.open(`https://www.google.com/maps?q=${incident.lat},${incident.lng}`, "_blank", "noopener");
  }
  if (action === "cycle-traffic") {
    const segment = trafficSegments.find((item) => item.id === button.dataset.id);
    const levels = [{ level: "Fluide", speed: 48 }, { level: "Modéré", speed: 31 }, { level: "Dense", speed: 18 }, { level: "Bloqué", speed: 0 }];
    const index = levels.findIndex((item) => item.level === segment.level);
    Object.assign(segment, levels[(index + 1) % levels.length]);
    toast("Trafic actualisé", `${segment.name} : ${segment.level}.`);
    renderCurrentModule();
  }
  if (action === "advance-mission") advanceMission();
  if (action === "mark-all-read") {
    await Promise.all(state.notifications.filter((item)=>item.unread).map((item)=>apiFetch(`/api/v1/notifications/${item.id}/read`,{method:'PATCH'}).catch(()=>null)));
    state.notifications.forEach((item) => { item.unread = false; });
    updateCounters();
    renderCurrentModule();
  }
  if (action === "read-notification") {
    const notification = state.notifications.find((item) => String(item.id) === button.dataset.id);
    if (notification) { await apiFetch(`/api/v1/notifications/${notification.id}/read`,{method:'PATCH'}).catch(()=>null); notification.unread = false; }
    updateCounters();
    renderCurrentModule();
  }
  if (action === "admission-status") {
    try {
      await apiFetch(`/api/v1/admissions/${button.dataset.id}/status`, { method:"PATCH", body:JSON.stringify({ status:button.dataset.status }) });
      toast("Admission mise à jour", button.dataset.status === 'accepted' ? "Demande acceptée." : "Demande refusée.");
      await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast("Décision refusée", error.message); }
  }
  if (action === "grant-role") {
    const role = window.prompt('Rôle à attribuer : admin, supervisor, dispatcher, firefighter, ambulance_driver, hospital_manager, hospital_agent, zem_driver ou citizen');
    if (!role) return;
    const globalRoles = ['citizen','zem_driver'];
    let organizationId = null;
    if (!globalRoles.includes(role)) {
      const choices = state.organizations.map((item)=>`${item.code || item.name}=${item.id}`).join('\n');
      organizationId = window.prompt(`ID de l’organisation :\n${choices}`);
      if (!organizationId) return;
    }
    try {
      await apiFetch(`/api/v1/admin/users/${button.dataset.id}/roles`, { method:'POST', body:JSON.stringify({ role, organization_id:organizationId }) });
      toast('Rôle attribué', `${role} a été ajouté.`); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Attribution refusée', error.message); }
  }
  if (action === "revoke-role") {
    const suffix = button.dataset.organizationId ? `?organization_id=${encodeURIComponent(button.dataset.organizationId)}` : '';
    try {
      await apiFetch(`/api/v1/admin/users/${button.dataset.id}/roles/${encodeURIComponent(button.dataset.role)}${suffix}`, { method:'DELETE' });
      toast('Rôle retiré', `${button.dataset.role} a été retiré.`); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Retrait refusé', error.message); }
  }
  if (action === "create-organization") {
    const name = window.prompt('Nom de l’organisation'); if (!name) return;
    const type = window.prompt('Type : hospital, clinic, fire_station, samu, ambulance_service, police, gendarmerie ou partner'); if (!type) return;
    const code = window.prompt('Code institutionnel unique'); if (!code) return;
    try {
      await apiFetch('/api/v1/organizations', { method:'POST', body:JSON.stringify({ name,type,code }) });
      toast('Organisation créée', name); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Création refusée', error.message); }
  }
  if (action === "create-hospital-agent") {
    const first_name=window.prompt('Prénom'); if(!first_name)return;
    const last_name=window.prompt('Nom'); if(!last_name)return;
    const phone=window.prompt('Téléphone'); if(!phone)return;
    const password=window.prompt('Mot de passe temporaire (12 caractères minimum)'); if(!password)return;
    try {
      await apiFetch(`/api/v1/organizations/${session.user.organizationId}/agents`,{method:'POST',body:JSON.stringify({first_name,last_name,phone,password,role:'hospital_agent'})});
      toast('Agent créé',`${first_name} ${last_name}`); await loadOperationalData(); renderCurrentModule();
    } catch(error){toast('Création refusée',error.message);}
  }
  if (action === "deactivate-member") {
    try {
      await apiFetch(`/api/v1/organizations/${session.user.organizationId}/members/${button.dataset.id}`,{method:'DELETE'});
      toast('Agent désactivé','Ses rôles institutionnels ont été retirés.'); await loadOperationalData(); renderCurrentModule();
    } catch(error){toast('Désactivation refusée',error.message);}
  }
  if (action === "create-user") {
    const first_name = window.prompt('Prénom'); if (!first_name) return;
    const last_name = window.prompt('Nom'); if (!last_name) return;
    const phone = window.prompt('Téléphone international'); if (!phone) return;
    const password = window.prompt('Mot de passe temporaire (12 caractères minimum)'); if (!password) return;
    try {
      await apiFetch('/api/v1/admin/users', { method:'POST', body:JSON.stringify({ first_name,last_name,phone,password }) });
      toast('Compte créé', `${first_name} ${last_name}`); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Création refusée', error.message); }
  }
  if (action === "request-admission") {
    if (!state.mission) return;
    const choices = hospitals.map((item)=>`${item.name}=${item.id} (${item.beds} places)`).join('\n');
    const hospitalId = window.prompt(`ID de l’hôpital cible :\n${choices}`); if (!hospitalId) return;
    try {
      await apiFetch(`/api/v1/interventions/${state.mission.interventionId}/admissions`, { method:'POST', body:JSON.stringify({ hospital_id:hospitalId,patient_summary:{} }) });
      toast('Admission demandée','L’hôpital a été notifié.'); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Demande refusée',error.message); }
  }
  if (action === "zem-application") {
    const review_note = window.prompt('Note de décision (facultative)') || '';
    try {
      await apiFetch(`/api/v1/zem/applications/${button.dataset.id}`, { method:'PATCH', body:JSON.stringify({ status:button.dataset.status,review_note }) });
      toast('Demande Zem mise à jour',button.dataset.status); await loadOperationalData(); renderCurrentModule();
    } catch (error) { toast('Décision refusée',error.message); }
  }
  if (action === "toggle-theme") toggleTheme();
  if (action === "copy-api") {
    await navigator.clipboard?.writeText(API_URL);
    toast("URL copiée", API_URL);
  }
  if (action === "open-citizen") window.open(window.LOTISEC_CITIZEN_URL || 'https://lotisec-frontend.vercel.app','_blank','noopener');
  if (action === "test-api") {
    try {
      await apiFetch('/health');
      toast("API opérationnelle", "La console communique avec le backend LOTISEC.");
    } catch (error) {
      toast("API indisponible", error.message || "Connexion impossible.");
    }
  }
});

channel?.addEventListener("message", (event) => {
  if (event.data?.type === "incident.created") ingestIncident(event.data.payload);
});

window.addEventListener("storage", (event) => {
  if (event.key !== EVENT_KEY || !event.newValue) return;
  try { ingestIncident(JSON.parse(event.newValue).incident); } catch {}
});

window.setInterval(() => {
  setText("[data-clock]", new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
  const last = state.incidents[0];
  if (last) setText("[data-last-sync]", `Dernier événement ${formatRelative(last.createdAt)}`);
  if (state.mission && ["En route", "Vers l'hôpital"].includes(state.mission.phase)
    && state.mission.progress < 100
    && Date.now() >= Number(state.mission.departureHoldUntil || 0)) {
    const increment = state.mission.routeBlocked ? 0.35 : 0.55;
    state.mission.progress = Math.min(100, state.mission.progress + increment);
    if (state.mission.progress >= 100) {
      state.mission.phase = state.mission.phase === "En route" ? "Sur place" : "Terminée";
      state.mission.speed = 0;
    }
    updateLiveMissionElements();
  }
}, 1000);

window.setInterval(pollMobileApi, 3000);

const savedTheme = localStorage.getItem(THEME_KEY);
setTheme(savedTheme === "light" ? "light" : "dark");
renderIncidents();
updateLastSync();
const hashModule = [...document.querySelectorAll("[data-module]")].find((link) => link.getAttribute("href") === location.hash)?.dataset.module;
if (hashModule) switchModule(hashModule);
pollMobileApi();
applyRbac();
loadOperationalData();
startRealtime();
