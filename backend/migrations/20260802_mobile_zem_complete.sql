CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE rides ADD COLUMN IF NOT EXISTS offered_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_en_route_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_arrived_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_ready_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_completed_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_completed_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_code text;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Les anciennes demandes `requested` sont conservées telles quelles pour que cette
-- migration reste additive. Seules les nouvelles courses utilisent le cycle canonique.

CREATE TABLE IF NOT EXISTS ride_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  zem_id varchar(255) NOT NULL REFERENCES users(id),
  sequence integer NOT NULL,
  distance_km double precision,
  status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','declined','expired','canceled')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  UNIQUE(ride_id, zem_id)
);
CREATE INDEX IF NOT EXISTS ride_offers_zem_status_idx ON ride_offers(zem_id,status,expires_at DESC);

CREATE TABLE IF NOT EXISTS ride_events (
  id bigserial PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  actor_id varchar(255) REFERENCES users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ride_events_ride_created_idx ON ride_events(ride_id,created_at);

CREATE TABLE IF NOT EXISTS ride_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id varchar(255) NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),
  client_message_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE(sender_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS ride_messages_ride_created_idx ON ride_messages(ride_id,created_at DESC);

CREATE TABLE IF NOT EXISTS ride_positions (
  id bigserial PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  user_id varchar(255) NOT NULL REFERENCES users(id),
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  accuracy double precision,
  heading double precision,
  speed double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ride_positions_ride_created_idx ON ride_positions(ride_id,created_at DESC);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'unknown',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx ON device_push_tokens(user_id,active);

CREATE TABLE IF NOT EXISTS scan_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar(255) NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id varchar(255) REFERENCES users(id),
  actor_role text,
  organization_id uuid REFERENCES organizations(id),
  authority text NOT NULL,
  access_level text NOT NULL DEFAULT 'medical_emergency',
  latitude double precision,
  longitude double precision,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scan_access_profile_created_idx ON scan_access_events(profile_id,created_at DESC);

ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS opening_hours text;
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS emergency_level text;
ALTER TABLE medical_facilities ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS medical_facilities_source_unique ON medical_facilities(source,source_id) WHERE source_id IS NOT NULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ride_offers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ride_events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ride_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ride_positions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE zem_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rides_participant_select ON rides;
CREATE POLICY rides_participant_select ON rides FOR SELECT TO authenticated USING (
  passenger_id=(auth.jwt()->>'app_user_id') OR zem_id=(auth.jwt()->>'app_user_id')
);
DROP POLICY IF EXISTS zem_locations_participant_select ON zem_locations;
CREATE POLICY zem_locations_participant_select ON zem_locations FOR SELECT TO authenticated USING (
  zem_id=(auth.jwt()->>'app_user_id') OR EXISTS(
    SELECT 1 FROM rides r WHERE r.zem_id=zem_locations.zem_id AND r.passenger_id=(auth.jwt()->>'app_user_id')
      AND r.status IN ('accepted','driver_en_route','driver_arrived','ready_to_start','in_progress','driver_completed')
  )
);
DROP POLICY IF EXISTS ride_offers_participant_select ON ride_offers;
CREATE POLICY ride_offers_participant_select ON ride_offers FOR SELECT TO authenticated USING (
  zem_id=(auth.jwt()->>'app_user_id') OR EXISTS(SELECT 1 FROM rides r WHERE r.id=ride_id AND r.passenger_id=(auth.jwt()->>'app_user_id'))
);
DROP POLICY IF EXISTS ride_events_participant_select ON ride_events;
CREATE POLICY ride_events_participant_select ON ride_events FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM rides r WHERE r.id=ride_id AND (r.passenger_id=(auth.jwt()->>'app_user_id') OR r.zem_id=(auth.jwt()->>'app_user_id')))
);
DROP POLICY IF EXISTS ride_messages_participant_select ON ride_messages;
CREATE POLICY ride_messages_participant_select ON ride_messages FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM rides r WHERE r.id=ride_id AND (r.passenger_id=(auth.jwt()->>'app_user_id') OR r.zem_id=(auth.jwt()->>'app_user_id')))
);
DROP POLICY IF EXISTS ride_positions_participant_select ON ride_positions;
CREATE POLICY ride_positions_participant_select ON ride_positions FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM rides r WHERE r.id=ride_id AND (r.passenger_id=(auth.jwt()->>'app_user_id') OR r.zem_id=(auth.jwt()->>'app_user_id')))
);
DROP POLICY IF EXISTS scan_access_owner_select ON scan_access_events;
CREATE POLICY scan_access_owner_select ON scan_access_events FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id=profile_id AND p.user_id=(auth.jwt()->>'app_user_id'))
);
