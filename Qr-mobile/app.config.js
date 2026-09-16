const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = { ...(appJson.expo || appJson), ...config };
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const isAndroidBuild =
    process.env.EAS_BUILD_PLATFORM === 'android' ||
    process.env.EAS_BUILD_PROFILE === 'preview' ||
    process.env.EAS_BUILD_PROFILE === 'production';

  if (isAndroidBuild && !apiKey) {
    throw new Error(
      "[LOTISEC BUILD ERROR] GOOGLE_MAPS_API_KEY manquante pour le build Android (profil: " +
        (process.env.EAS_BUILD_PROFILE || 'preview/production') +
        "). Renseignez GOOGLE_MAPS_API_KEY dans EAS Secret (eas env:create) ou dans votre fichier .env pour éviter un crash au démarrage de MapView."
    );
  }

  const androidConfig = { ...base.android?.config };
  if (apiKey) {
    androidConfig.googleMaps = { apiKey };
  } else {
    androidConfig.googleMaps = {};
  }

  return {
    ...base,
    android: {
      ...base.android,
      config: androidConfig,
    },
  };
};

