import { Linking, Platform } from 'react-native';

export const Helpers = {
  // Formater le numéro pour WhatsApp (enlever les espaces et caractères spéciaux)
  formatPhoneForWA: (phone: string) => {
    return phone.replace(/[^\d]/g, "");
  },

  // Générer le lien Google Maps
  getMapsUrl: (lat: number, lon: number) => {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  },

  // Lancer la navigation native
  launchNavigation: (lat: number, lon: number, label: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lon}`,
      android: `google.navigation:q=${lat},${lon}`
    });
    Linking.openURL(url!);
  }
};