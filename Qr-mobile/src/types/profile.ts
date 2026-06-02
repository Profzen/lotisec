// Type de profil
export type ProfileType = 'adult' | 'student';

// Un contact d'urgence
export interface EmergencyContact {
  name:  string;
  phone: string;
  relation?: string;
}

// Informations école (élève uniquement)
export interface SchoolInfo {
  schoolName:      string;
  className:       string;
  directorName:    string;
  directorPhone:   string;
  parentName:      string;
  parentPhone:     string;
}

// Véhicule
export interface VehicleInfo {
  hasVehicle:      boolean;
  type?:           string;
  plate?:          string;
  brand?:          string;
  model?:          string;
  color?:          string;
}

// Profil complet
export interface ProfileData {
  // Étape 0 — type
  profileType:     ProfileType;

  // Étape 1 — identité
  firstName:       string;
  lastName:        string;
  birthDate:       string;
  gender:          string;
  nationality:     string;
  phone:           string;
  photoUri?:       string;
  
  // AJOUT ICI : Champs requis par le backend Railway
  documentType:    string; 
  documentNumber:  string;

  // Étape 2 — contacts
  emergencyContacts: EmergencyContact[];
  schoolInfo?:       SchoolInfo;

  // Étape 3 — médical
  bloodType:       string;
  allergies?:      string;
  conditions?:     string;
  medications?:    string;
  surgeries?:      string;
  disabilities?:   string;

  // Étape 4 — véhicule
  vehicle:         VehicleInfo;
}

// Valeurs par défaut mises à jour
export const emptyProfile: ProfileData = {  
  profileType:       'adult',
  firstName:         '',
  lastName:          '',
  birthDate:         '',
  gender:            '',
  nationality:       '',
  phone:             '',
  documentType:      'CNI',          // Valeur par défaut pour éviter le NULL
  documentNumber:    'Non renseigné', // Valeur par défaut pour éviter le NULL
  emergencyContacts: [{ name: '', phone: '', relation: '' }],
  bloodType:         '',
  disabilities:      '',
  vehicle:           { hasVehicle: false },
};