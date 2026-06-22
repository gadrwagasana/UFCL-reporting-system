// Dynamic Expo config — replaces static app.json.
// Reads environment variables from the active .env.* file selected by APP_ENV.
// Expo SDK 51 loads .env files automatically; no dotenv import needed.

const APP_ENV = process.env.APP_ENV ?? 'development';

const variants = {
  development: {
    appName:      'UFCL Dev',
    packageId:    'com.ufcl.mobile.dev',
    apiUrl:       process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.5:3001',
    versionCode:  1,
  },
  staging: {
    appName:      'UFCL Staging',
    packageId:    'com.ufcl.mobile.staging',
    apiUrl:       process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.5:3001',
    versionCode:  1,
  },
  production: {
    appName:      'UFCL Production',
    packageId:    'com.ufcl.mobile',
    apiUrl:       process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.5:3001',
    versionCode:  1,
  },
};

const v = variants[APP_ENV] ?? variants.development;

export default {
  expo: {
    name:          v.appName,
    slug:          'ufcl-mobile',
    version:       '1.0.0',
    orientation:   'portrait',
    icon:          './assets/icon.png',
    userInterfaceStyle: 'light',

    splash: {
      image:           './assets/splash.png',
      resizeMode:      'contain',
      backgroundColor: '#1a3c5e',
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a3c5e',
      },
      package:     v.packageId,
      versionCode: v.versionCode,
      permissions: ['android.permission.INTERNET'],
    },

    ios: {
      supportsTablet:   false,
      bundleIdentifier: v.packageId,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      ['expo-secure-store', { faceIDPermission: 'Allow UFCL to use Face ID.' }],
    ],

    extra: {
      apiUrl:  v.apiUrl,
      appEnv:  APP_ENV,
    },
  },
};
