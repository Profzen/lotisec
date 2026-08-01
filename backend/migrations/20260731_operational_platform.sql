-- LOTISEC operational platform: additive, backwards-compatible migration.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('lotisec','hospital','clinic','fire_station','samu','ambulance_service','police','gendarmerie','partner')),
  code text UNIQUE,
  phone text,
  address text,
  latitude double precision,
  longitude double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'
);

INSERT INTO roles (key, label, permissions) VALUES
 ('admin','Administrateur',ARRAY['*','admin:manage']),
 ('supervisor','Superviseur',ARRAY['incidents:read','incidents:manage','interventions:read','interventions:manage','resources:read','facilities:read','reports:read','zem:approve']),
 ('dispatcher','Opérateur',ARRAY['incidents:read','incidents:manage','interventions:read','interventions:manage','resources:read','facilities:read']),
 ('firefighter','Sapeur-pompier',ARRAY['interventions:assigned','interventions:update','facilities:read']),
 ('ambulance_driver','Ambulancier',ARRAY['interventions:assigned','interventions:update','facilities:read']),
 ('hospital_manager','Responsable hôpital',ARRAY['admissions:organization','facilities:manage','organization:members']),
 ('hospital_agent','Agent hospitalier',ARRAY['admissions:organization','facilities:read']),
 ('zem_driver','Conducteur Zem',ARRAY['zem:drive']),
 ('citizen','Citoyen',ARRAY['profile:self','incidents:create','zem:ride'])
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, permissions=EXCLUDED.permissions;

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id),
  role_key text NOT NULL REFERENCES roles(key),
  organization_id uuid REFERENCES organizations(id),
  granted_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_global_unique ON user_roles(user_id, role_key) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_organization_unique ON user_roles(user_id, role_key, organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS zem_driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  identity_document text,
  license_number text,
  motorcycle_make text,
  motorcycle_model text,
  plate text,
  work_zone text,
  review_note text,
  reviewed_by text REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS zem_driver_active_application ON zem_driver_applications(user_id) WHERE status IN ('pending','approved');

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  source text NOT NULL DEFAULT 'mobile' CHECK (source IN ('mobile','web','operator','ussd','partner')),
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','unknown')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','validated','rejected','assigned','en_route','on_scene','patient_loaded','to_hospital','arrived_hospital','completed','cancelled')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision NOT NULL DEFAULT 0,
  address text,
  victims integer NOT NULL DEFAULT 0,
  vehicles integer NOT NULL DEFAULT 0,
  vehicle_type text,
  description text,
  flags text[] NOT NULL DEFAULT '{}',
  priority_score integer NOT NULL DEFAULT 0,
  qr_token text,
  client_event_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_status_created_idx ON incidents(status, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id),
  type text NOT NULL,
  from_status text,
  to_status text,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS response_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  call_sign text,
  type text NOT NULL DEFAULT 'ambulance',
  registration text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','assigned','en_route','on_scene','transporting','maintenance','offline')),
  latitude double precision,
  longitude double precision,
  equipment jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  response_unit_id uuid REFERENCES response_units(id),
  assigned_to text REFERENCES users(id),
  hospital_id uuid REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'assigned',
  notes text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interventions_org_status_idx ON interventions(organization_id, status);

CREATE TABLE IF NOT EXISTS facility_capacities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  service text NOT NULL,
  available integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  operational boolean NOT NULL DEFAULT true,
  updated_by text REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, service)
);

CREATE TABLE IF NOT EXISTS hospital_admission_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES interventions(id),
  hospital_id uuid NOT NULL REFERENCES organizations(id),
  requested_by text REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','arrived','closed','cancelled')),
  patient_summary jsonb NOT NULL DEFAULT '{}',
  response_note text,
  responded_by text REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text REFERENCES users(id),
  organization_id uuid REFERENCES organizations(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS operational_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  recipient_user_id text REFERENCES users(id),
  recipient_roles text[] NOT NULL DEFAULT '{}',
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operational_notifications_scope_idx ON operational_notifications(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS notification_receipts (
  notification_id uuid NOT NULL REFERENCES operational_notifications(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(notification_id,user_id)
);

-- Clients subscribe to changes, but all sensitive writes remain behind the Node API.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE interventions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE facility_capacities;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hospital_admission_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE response_units;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE operational_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_capacities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_admission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incidents_realtime_select ON incidents;
CREATE POLICY incidents_realtime_select ON incidents FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher'] OR reporter_id = auth.jwt()->>'app_user_id'
);
DROP POLICY IF EXISTS interventions_realtime_select ON interventions;
CREATE POLICY interventions_realtime_select ON interventions FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher'] OR organization_id::text = auth.jwt()->>'organization_id' OR assigned_to = auth.jwt()->>'app_user_id'
);
DROP POLICY IF EXISTS capacities_realtime_select ON facility_capacities;
CREATE POLICY capacities_realtime_select ON facility_capacities FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher'] OR organization_id::text = auth.jwt()->>'organization_id'
);
DROP POLICY IF EXISTS admissions_realtime_select ON hospital_admission_requests;
CREATE POLICY admissions_realtime_select ON hospital_admission_requests FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher'] OR hospital_id::text = auth.jwt()->>'organization_id'
);
DROP POLICY IF EXISTS response_units_realtime_select ON response_units;
CREATE POLICY response_units_realtime_select ON response_units FOR SELECT TO authenticated USING (
  (auth.jwt()->'roles') ?| ARRAY['admin','supervisor','dispatcher'] OR organization_id::text = auth.jwt()->>'organization_id'
);
DROP POLICY IF EXISTS operational_notifications_realtime_select ON operational_notifications;
CREATE POLICY operational_notifications_realtime_select ON operational_notifications FOR SELECT TO authenticated USING (
  recipient_user_id = auth.jwt()->>'app_user_id'
  OR organization_id::text = auth.jwt()->>'organization_id'
  OR (auth.jwt()->'roles') ?| recipient_roles
  OR (auth.jwt()->'roles') ? 'admin'
);
