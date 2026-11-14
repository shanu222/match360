/**
 * One-time native setup for the Android app: system bars, keyboard, hardware back button, external links.
 * Imported only when VITE_PLATFORM=android.
 */
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';

/** Screens where Back leaves the app (minimises it) instead of navigating. */
const ROOT_PATHS = ['/', '/discover', '/login', '/onboarding'];

function closeTopLayer(): boolean {
  // Modals close on Escape (see components/ui.tsx); anything else can opt in with data-back-close.
  const closer = document.querySelector<HTMLElement>('[data-back-close]');
  if (closer) {
    closer.click();
    return true;
  }
  if (document.querySelector('[role="dialog"]')) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return true;
  }
  return false;
}

function onBack(canGoBack: boolean) {
  if (closeTopLayer()) return;
  // A screen can take over Back (the timed quiz asks before leaving).
  const ev = new CustomEvent('m360:back', { cancelable: true });
  if (!window.dispatchEvent(ev)) return;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (ROOT_PATHS.includes(path) || !canGoBack || window.history.length <= 1) {
    void App.minimizeApp();
    return;
  }
  window.history.back();
}

function interceptExternalLinks() {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      const external = /^(mailto:|tel:|sms:)/i.test(href) || (/^https?:\/\//i.test(href) && new URL(href).origin !== window.location.origin);
      if (!external) return;
      e.preventDefault();
      // Capacitor passes URLs outside the app origin to Android: system browser, mail app, dialler.
      window.location.assign(href);
    },
    true,
  );
}

export function initNative() {
  document.documentElement.classList.add('native-android');
  interceptExternalLinks();
  void App.addListener('backButton', ({ canGoBack }) => onBack(canGoBack));
  // System bar style and insets are handled by Capacitor's SystemBars (see capacitor.config.ts); no status-bar plugin,
  // because its colour calls are deprecated from Android 15.
  Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('keyboard-open')).catch(() => {});
  Keyboard.addListener('keyboardDidHide', () => document.documentElement.classList.remove('keyboard-open')).catch(() => {});
  SplashScreen.hide().catch(() => {});
}
