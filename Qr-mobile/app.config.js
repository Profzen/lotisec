import appJson from './app.json';

export default ({ config }) => {
  const base = { ...appJson.expo, ...config };
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

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
