import appJson from './app.json';

export default ({ config }) => {
  const base = { ...appJson.expo, ...config };
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    base.android?.config?.googleMaps?.apiKey ||
    'AIzaSy_FAKE_KEY_FOR_OPENSTREETMAP_BYPASS';

  return {
    ...base,
    android: {
      ...base.android,
      config: {
        ...base.android?.config,
        googleMaps: {
          apiKey,
        },
      },
    },
  };
};
