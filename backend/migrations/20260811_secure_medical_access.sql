-- Accès médical sécurisé : PIN citoyen hashé et codes d'urgence organisationnels temporaires.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code_hash text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS organization_emergency_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  label text NOT NULL DEFAULT 'Accès d’urgence',
  allowed_roles text[] NOT NULL DEFAULT ARRAY['firefighter','ambulance_driver','hospital_manager','hospital_agent']::text[],
  created_by text REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emergency_access_active_org_idx
  ON organization_emergency_access_codes(organization_id, expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE scan_access_events ADD COLUMN IF NOT EXISTS access_method text;
ALTER TABLE scan_access_events ADD COLUMN IF NOT EXISTS denial_reason text;
ALTER TABLE scan_access_events ADD COLUMN IF NOT EXISTS scanner_ip text;

ALTER TABLE organization_emergency_access_codes ENABLE ROW LEVEL SECURITY;
-- Aucun accès direct anon/authenticated : la gestion passe exclusivement par l'API backend et son RBAC.

-- Les anciens codes en clair restent uniquement le temps qu'un citoyen choisisse un nouveau PIN.
-- L'API migre automatiquement une valeur historique valide vers bcrypt lors de sa première utilisation.
