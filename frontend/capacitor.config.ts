import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sustainablesolution360.match360',
  appName: 'Match360',
  webDir: 'dist',
  server: {
    // The app's origin is https://localhost — add it to FRONTEND_ORIGIN on Railway.
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#F5F6FA',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 400,
      backgroundColor: '#F5F6FA',
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    FirebaseAuthentication: {
      // Native Google sign-in only returns the Google credential; the Firebase web SDK does the sign-in.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
