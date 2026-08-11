-- Journal transversal des mutations et historique GPS des unités de secours.
CREATE TABLE IF NOT EXISTS api_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  actor_id text REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  method text NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  route text NOT NULL,
  action text NOT NULL,
  status_code integer NOT NULL,
  success boolean NOT NULL,
  client_type text NOT NULL DEFAULT 'unknown',
  ip_address text,
  user_agent text,
  duration_ms integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_activity_actor_created_idx ON api_activity_logs(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS api_activity_org_created_idx ON api_activity_logs(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS api_activity_route_created_idx ON api_activity_logs(route,created_at DESC);
ALTER TABLE api_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS response_unit_positions (
  id bigserial PRIMARY KEY,
  response_unit_id uuid NOT NULL REFERENCES response_units(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  status text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS response_unit_positions_unit_time_idx ON response_unit_positions(response_unit_id,recorded_at DESC);
ALTER TABLE response_unit_positions ENABLE ROW LEVEL SECURITY;

-- Lecture Realtime limitée aux comptes de l'organisation ou aux superviseurs globaux.
DROP POLICY IF EXISTS response_unit_positions_select ON response_unit_positions;
CREATE POLICY response_unit_positions_select ON response_unit_positions FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher']
  OR organization_id::text = auth.jwt()->>'organization_id'
);
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE response_unit_positions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
