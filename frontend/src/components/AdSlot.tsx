import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useConfig } from '../lib/config';

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

let scriptAdded = false;
function ensureScript(client: string) {
  if (scriptAdded || typeof document === 'undefined') return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

/** Shows a Google AdSense unit to free members when ads are enabled in the admin panel. Premium members never see ads. */
export function AdSlot({ slot, className }: { slot: 'slotDiscover' | 'slotChats'; className?: string }) {
  const cfg = useConfig();
  const ref = useRef<HTMLModElement>(null);
  const ads = cfg.data?.ads;
  const slotId = ads?.[slot];
  const show = Boolean(cfg.data && !cfg.data.premium && ads?.enabled && ads.adsenseClient && slotId);

  useEffect(() => {
    if (!show || !ads) return;
    ensureScript(ads.adsenseClient);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blockers or duplicate pushes — ignore */
    }
  }, [show, ads]);

  if (!show || !ads) return null;
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs text-slate">
        <span>Advertisement</span>
        <Link to="/premium" className="font-medium text-cobalt hover:underline">Remove ads</Link>
      </div>
      <ins ref={ref} className="adsbygoogle block min-h-[90px] overflow-hidden rounded-xl bg-card" data-ad-client={ads.adsenseClient} data-ad-slot={slotId} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
