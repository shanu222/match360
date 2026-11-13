import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { isAndroidApp } from '../lib/platform';
import { Spinner } from './ui';

async function isOnline(): Promise<boolean> {
  if (isAndroidApp) {
    try {
      const { Network } = await import('@capacitor/network');
      return (await Network.getStatus()).connected;
    } catch {
      /* fall through to the browser signal */
    }
  }
  return navigator.onLine !== false;
}

/**
 * Android app: when the phone has no connection, shows a clear “You’re offline” screen with a retry button
 * instead of spinners or a blank page. The app underneath stays mounted, so nothing typed is lost.
 * On the website this only renders its children.
 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isAndroidApp) return;
    let alive = true;
    let wasOffline = false;
    const apply = (online: boolean) => {
      if (!alive) return;
      setOffline(!online);
      if (online && wasOffline) void qc.invalidateQueries();
      wasOffline = !online;
    };
    const sync = () => void isOnline().then(apply);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    let remove: (() => void) | undefined;
    void import('@capacitor/network')
      .then(({ Network }) => Network.addListener('networkStatusChange', (s) => apply(s.connected)))
      .then((h) => {
        if (alive) remove = () => void h.remove();
        else void h.remove();
      })
      .catch(() => {});
    return () => {
      alive = false;
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      remove?.();
    };
  }, [qc]);

  const retry = async () => {
    setChecking(true);
    const online = await isOnline();
    // Keep the spinner visible briefly so the tap clearly did something.
    await new Promise((r) => setTimeout(r, 500));
    setChecking(false);
    if (online) {
      setOffline(false);
      void qc.invalidateQueries();
    }
  };

  return (
    <>
      {children}
      {offline && (
        <div role="alertdialog" aria-label="You’re offline" className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-rule bg-card text-cobalt">
            <WifiOff size={32} />
          </div>
          <h1 className="text-2xl font-bold">You’re offline</h1>
          <p className="max-w-xs text-slate">Match360 needs an internet connection. Check your Wi-Fi or mobile data, then try again.</p>
          <button className="btn btn-primary min-w-36" onClick={retry} disabled={checking}>
            {checking ? <Spinner size={20} className="text-white" /> : 'Try again'}
          </button>
        </div>
      )}
    </>
  );
}
