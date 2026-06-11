const BASE_URL = "https://lotisec-backend.vercel.app";

export const EmergencyService = {
  // Récupérer l'établissement le plus proche via latitude/longitude
  getNearestFacility: async (lat: number, lon: number) => {
    try {
      const response = await fetch(`${BASE_URL}/emergency/nearest?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error("Erreur Backend");
      return await response.json();
    } catch (error) {
      console.error("Erreur API:", error);
      // Fallback local si le serveur est down (Hôpital de référence au Togo)
      return {
        name: "Hôpital Dogta-Lafiè",
        phone: "+22822530100",
        latitude: 6.2085,
        longitude: 1.2015
      };
    }
  }
};