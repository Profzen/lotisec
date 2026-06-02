export interface Country {
  label: string;
  value: string;
  dialCode: string;
  flag: string;
  format: string;
}

export const SUPPORTED_COUNTRIES: Country[] = [
  { 
    label: 'Togo', 
    value: 'Togolaise', 
    dialCode: '+228', 
    flag: '🇹🇬', 
    format: '90 00 00 00' 
  },
  { 
    label: 'Bénin', 
    value: 'Béninoise', 
    dialCode: '+229', 
    flag: '🇧🇯', 
    format: '60 00 00 00' 
  },
  { 
    label: 'Burkina Faso', 
    value: 'Burkinabè', 
    dialCode: '+226', 
    flag: '🇧🇫', 
    format: '70 00 00 00' 
  },
  { 
    label: 'Côte d’Ivoire', 
    value: 'Ivoirienne', 
    dialCode: '+225', 
    flag: '🇨🇮', 
    format: '07 00 00 00' 
  }
];

/**
 * Nettoie le numéro de téléphone pour ne garder que les chiffres
 */
export const cleanPhone = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Formate l'affichage du téléphone (ajoute des espaces)
 */
export const formatPhoneDisplay = (text: string): string => {
  const cleaned = cleanPhone(text);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
};

/**
 * Gestion centralisée des messages d'erreur du formulaire
 */
export const getErrorMessage = (field: string, value: string): string | null => {
  if (!value || value.trim() === '') {
    return "Ce champ est obligatoire.";
  }

  switch (field) {
    case 'firstName':
      return value.length < 2 ? "Le prénom est trop court." : null;
    case 'lastName':
      return value.length < 2 ? "Le nom est trop court." : null;
    case 'phone':
      return cleanPhone(value).length < 8 ? "Numéro de téléphone invalide." : null;
    case 'password':
      return value.length < 8 ? "Le mot de passe doit faire au moins 8 caractères." : null;
    case 'birthDate':
      // Vérification simple du format JJ/MM/AAAA
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      return !dateRegex.test(value) ? "Format date invalide (JJ/MM/AAAA)." : null;
    default:
      return null;
  }
};