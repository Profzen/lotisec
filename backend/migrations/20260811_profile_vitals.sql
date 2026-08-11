ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height numeric(5,2),
  ADD COLUMN IF NOT EXISTS weight numeric(6,2),
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS doctor_phone text;

COMMENT ON COLUMN profiles.height IS 'Taille du citoyen en centimètres';
COMMENT ON COLUMN profiles.weight IS 'Poids du citoyen en kilogrammes';
COMMENT ON COLUMN profiles.doctor_name IS 'Nom facultatif du médecin traitant';
COMMENT ON COLUMN profiles.doctor_phone IS 'Téléphone facultatif du médecin traitant';
