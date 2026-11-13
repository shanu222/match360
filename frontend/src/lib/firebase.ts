import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { isAndroidApp } from './platform';

const env = import.meta.env;

/**
 * In production the Firebase auth handler is proxied through our own domain (see vercel.json),
 * so sign-in works with third-party-storage restrictions (Safari, Chrome, mobile) and redirects.
 */
const isLocal = typeof window !== 'undefined' && /^(localhost|127\.|192\.168\.)/.test(window.location.hostname);
// Inside the Android app the origin is https://localhost, so the “site host” trick doesn’t apply: use the Firebase domain.
const authDomain = isAndroidApp
  ? env.VITE_FIREBASE_AUTH_DOMAIN || 'match360-3c99e.firebaseapp.com'
  : import.meta.env.PROD && !isLocal
    ? window.location.host
    : env.VITE_FIREBASE_AUTH_DOMAIN;
export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_AUTH_DOMAIN && env.VITE_FIREBASE_PROJECT_ID);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
if (firebaseConfigured) {
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  });
  auth = getAuth(app);
}
export { auth };
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Test-only auth for local development (never active in production builds). */
export const testAuthEnabled = import.meta.env.DEV && env.VITE_TEST_AUTH === '1';

export function friendlyAuthError(code: string): string {
  const m: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and try again.',
    'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it under Authentication › Settings › Authorised domains.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    'auth/app-not-authorized': 'Google sign-in isn’t set up for this build of the app yet. Please use email and password for now.',
    'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in with your email and password.',
  };
  return m[code] || 'Something went wrong. Please try again.';
}

/** Phones and tablets get the redirect flow — popups are unreliable there. */
export const preferRedirect = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);
