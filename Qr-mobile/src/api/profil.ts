// src/api/profil.ts
import { api } from './config';
import { ProfileData, EmergencyContact } from '../types/profile'; 

export const createProfil = async (profile: ProfileData, token: string) => {
  // Fonction utilitaire pour s'assurer qu'on n'envoie JAMAIS de null/undefined
  const ensureString = (val: any, fallback: string = "") => {
    if (val === null || val === undefined || val === "") return fallback;
    return String(val);
  };

  const payload: any = {
    profile_type: ensureString(profile.profileType, 'adult'),
    first_name: ensureString(profile.firstName),
    last_name: ensureString(profile.lastName),
    birth_date: ensureString(profile.birthDate),
    gender: ensureString(profile.gender, 'Masculin'),
    nationality: ensureString(profile.nationality, 'Ivoirienne'),
    
    // ON FORCE ICI LES VALEURS QUI FONT PLANTER LA DB
    document_type: ensureString(profile.documentType, 'Non renseigné'),
    document_number: ensureString(profile.documentNumber, '0000'),
    
    blood_type: ensureString(profile.bloodType, 'A+'),
    allergies: ensureString(profile.allergies),
    conditions: ensureString(profile.conditions),
    medications: ensureString(profile.medications),
    surgeries: ensureString(profile.surgeries),
    disabilities: ensureString(profile.disabilities),
    
    // Le backend semble attendre un booléen pour has_vehicle (t ou f dans les logs)
    has_vehicle: !!profile.vehicle?.hasVehicle,

    emergency_contacts: (profile.emergencyContacts || []).map((c: EmergencyContact) => ({
      name: ensureString(c.name, 'Contact'),
      phone: ensureString(c.phone, '00000000'),
      relation: ensureString(c.relation, 'Proche'),
    })),
  };

  // Ajout des infos véhicule si présent
  if (profile.vehicle && profile.vehicle.hasVehicle) {
    payload.vehicle_type = ensureString(profile.vehicle.type, 'Moto');
    payload.plate = ensureString(profile.vehicle.plate, 'À renseigner');
    payload.brand = ensureString(profile.vehicle.brand, 'N/A');
    payload.model = ensureString(profile.vehicle.model, 'N/A');
  }

  // Debug pour toi dans la console de VS Code / Metro
  console.log("Payload final envoyé :", payload);

  // Utilisation de l'URL qui a provoqué la 500 (car c'est la bonne route)
  return await api('/profil', 'POST', payload, token);
};