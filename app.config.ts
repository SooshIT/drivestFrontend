import 'dotenv/config';
import { ExpoConfig } from '@expo/config-types';

const config: ExpoConfig = {
  name: 'Drivest',
  slug: 'drivest-app',
  owner: 'vivek921921',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'drivest',
  icon: './assets/logo.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/logo.png',
    resizeMode: 'cover',
    backgroundColor: '#f2f6ff',
  },
  ios: {
    bundleIdentifier: 'com.drivest.app',
    supportsTablet: true,
    splash: {
      image: './assets/logo.png',
      resizeMode: 'cover',
      backgroundColor: '#f2f6ff',
    },
  },
  android: {
    package: 'com.drivest.app',
    adaptiveIcon: {
      foregroundImage: './assets/logo.png',
      backgroundColor: '#f5f7ff',
    },
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    splash: {
      image: './assets/logo.png',
      resizeMode: 'cover',
      backgroundColor: '#f2f6ff',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    '@sentry/react-native',
    'expo-font',
    'expo-location',
    'expo-notifications',
    'expo-secure-store',
    'expo-sqlite',
    ['@rnmapbox/maps', { RNMapboxMapsImpl: 'mapbox' }],
  ],
  extra: {
     "eas": {
        "projectId": "43f1f6c8-d45d-447c-bb1d-6d1138449496"
      },
   
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
    mapboxDownloadToken: process.env.EXPO_PUBLIC_MAPBOX_DOWNLOAD_TOKEN,
    revcatKey: process.env.EXPO_PUBLIC_REVCAT_API_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sentryEnv: process.env.EXPO_PUBLIC_SENTRY_ENV,
  },
};

export default config;
