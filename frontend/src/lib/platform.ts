/**
 * Build-time platform switch. `vite build --mode android` sets VITE_PLATFORM=android (see .env.android).
 * It is a compile-time constant, so web-only code (admin panel, AdSense, manual payments) is removed
 * from the Android bundle and native-only code is removed from the website bundle.
 */
export const isAndroidApp = import.meta.env.VITE_PLATFORM === 'android';

/** Opens a link outside the app (system browser, mail app). On the web it is a normal new tab. */
export function openExternal(url: string) {
  if (isAndroidApp) {
    // Capacitor hands any URL outside the app's own origin to Android (browser, mail, dialler).
    window.location.assign(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
