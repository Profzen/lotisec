import { env } from "cloudflare:workers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-LOTISEC-Client",
  "Cache-Control": "no-store"
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function scoreIncident(severity, victims, vehicles, flags) {
  const base = { critical: 78, high: 62, medium: 42, low: 24 }[severity] || 40;
  return Math.min(99, base + Math.min(victims * 3, 12) + Math.min(vehicles * 2, 8) + Math.min(flags.length * 2, 6));
}

function normalizeRow(row) {
  return {
    id: row.id,
    source: "mobile",
    type: row.type,
    severity: row.severity,
    place: row.place || "",
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    accuracy: Number(row.accuracy),
    victims: Number(row.victims),
    vehicles: Number(row.vehicles),
    photos: Number(row.photos),
    description: row.description || "",
    flags: JSON.parse(row.flags_json || "[]"),
    status: row.status,
    score: Number(row.priority_score),
    latency: Number(row.fog_latency),
    createdAt: Number(row.created_at),
    device: row.device || "Application mobile LOTISEC",
    reporter: row.reporter || "Usager public · SOS mobile"
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request) {
  try {
    const since = Math.max(0, Number(new URL(request.url).searchParams.get("since") || 0));
    const result = await env.DB.prepare(
      "SELECT * FROM mobile_incidents WHERE created_at > ? ORDER BY created_at ASC LIMIT 100"
    ).bind(since).all();
    return json({ incidents: (result.results || []).map(normalizeRow), serverTime: Date.now() });
  } catch (error) {
    return json({ error: "mobile_incident_feed_unavailable", detail: error instanceof Error ? error.message : "Unknown error" }, 503);
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const latitude = Number(payload.lat ?? payload.latitude);
    const longitude = Number(payload.lng ?? payload.longitude);
    const victims = Math.max(0, Math.min(99, Number(payload.victims || 0)));
    const vehicles = Math.max(0, Math.min(30, Number(payload.vehicles || 0)));
    const accuracy = Math.max(0, Math.min(5000, Number(payload.accuracy || 0)));
    const flags = Array.isArray(payload.flags) ? payload.flags.slice(0, 12).map(String) : [];
    const severity = ["critical", "high", "medium", "low"].includes(payload.severity) ? payload.severity : "medium";

    if (!payload.type || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json({ error: "type, latitude and longitude are required" }, 400);
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return json({ error: "invalid GPS coordinates" }, 400);
    }

    const createdAt = Number(payload.createdAt) || Date.now();
    const id = String(payload.id || `INC-${createdAt}-${crypto.randomUUID().slice(0, 6)}`);
    const latency = Math.floor(Math.random() * 21) + 20;
    const priorityScore = scoreIncident(severity, victims, vehicles, flags);

    await env.DB.prepare(
      `INSERT INTO mobile_incidents
       (id, type, severity, place, latitude, longitude, accuracy, victims, vehicles, photos,
        description, flags_json, status, priority_score, fog_latency, device, reporter, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    ).bind(
      id, String(payload.type).slice(0, 120), severity, String(payload.place || "").slice(0, 240),
      latitude, longitude, accuracy, victims, vehicles, Math.max(0, Math.min(5, Number(payload.photos || 0))),
      String(payload.description || "").slice(0, 1000), JSON.stringify(flags), "new",
      priorityScore, latency, String(payload.device || "Application mobile LOTISEC").slice(0, 160),
      String(payload.reporter || "Usager public · SOS mobile").slice(0, 160), createdAt
    ).run();

    const row = await env.DB.prepare("SELECT * FROM mobile_incidents WHERE id = ?").bind(id).first();
    return json({ incident: normalizeRow(row), fog: { node: "FOG-LOMÉ-01", latency, priorityScore } }, 201);
  } catch (error) {
    return json({ error: "mobile_incident_not_saved", detail: error instanceof Error ? error.message : "Unknown error" }, 503);
  }
}
