/**
 * Native Google sign-in for the Android app. Google blocks OAuth inside WebViews, so the account picker is
 * shown natively and the resulting ID token is handed to the Firebase web SDK. From there the rest of the
 * app (AuthContext, getIdToken() for the API) works exactly as on the website.
 */
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';

/** Resolves true when signed in, false when the user closed the picker. Throws `{ code }` on real errors. */
export async function nativeGoogleSignIn(): Promise<boolean> {
  if (!auth) throw { code: 'auth/unknown' };
  let idToken: string | undefined;
  try {
    const res = await FirebaseAuthentication.signInWithGoogle();
    idToken = res.credential?.idToken ?? undefined;
  } catch (e: any) {
    const msg = `${e?.code || ''} ${e?.message || ''}`.toLowerCase();
    if (/cancel|12501|no credentials? available|dismiss/.test(msg)) return false;
    console.warn('[auth] native Google sign-in failed', e);
    // Code 10 / "developer error" means the app's SHA-1 is missing in Firebase.
    throw { code: /network/.test(msg) ? 'auth/network-request-failed' : /\b10\b|developer/.test(msg) ? 'auth/app-not-authorized' : 'auth/unknown' };
  }
  if (!idToken) throw { code: 'auth/unknown' };
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return true;
}

/** Clears the native Google session so the account picker appears again on the next sign-in. */
export async function nativeSignOut() {
  await FirebaseAuthentication.signOut().catch(() => {});
}
