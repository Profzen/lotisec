CREATE TABLE IF NOT EXISTS mobile_incidents (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL DEFAULT 0,
  victims INTEGER NOT NULL DEFAULT 0,
  vehicles INTEGER NOT NULL DEFAULT 0,
  photos INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  flags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  priority_score INTEGER NOT NULL DEFAULT 0,
  fog_latency INTEGER NOT NULL DEFAULT 0,
  device TEXT NOT NULL DEFAULT '',
  reporter TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mobile_incidents_created_at_idx ON mobile_incidents (created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mobile_incidents_status_idx ON mobile_incidents (status);
