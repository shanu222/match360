import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { isAndroidApp } from '../lib/platform';
import { ADS } from '../native/adsConfig';

/**
 * Android app only: an AdMob adaptive banner that sits just above the bottom tab bar on Discover, Requests
 * and Profile, for free members. It is a native view drawn over the page, so it is hidden whenever the
 * keyboard or a dialog is open, and the page reserves its height through the --ad-h CSS variable.
 * Premium members never load the ads SDK at all.
 */
export function AdBanner({ premium }: { premium: boolean }) {
  if (!isAndroidApp) return null;
  return <NativeBanner premium={premium} />;
}

function NativeBanner({ premium }: { premium: boolean }) {
  const loc = useLocation();
  const probe = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(false); // keyboard or a dialog is open
  const onRoute = ADS.bannerRoutes.includes(loc.pathname.replace(/\/+$/, ''));
  const active = !premium && onRoute && !covered;

  useEffect(() => {
    const check = () => setCovered(document.documentElement.classList.contains('keyboard-open') || Boolean(document.querySelector('[role="dialog"]')));
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    check();
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import('../native/ads').then((ads) => {
      if (cancelled) return;
      if (premium) return void ads.removeAds();
      if (!active) return void ads.hideBanner();
      // The plugin adds the system navigation inset itself, so pass only the tab bar's own height.
      const bar = document.getElementById('tabbar');
      const barH = bar && bar.offsetParent !== null ? bar.getBoundingClientRect().height : 0;
      const inset = probe.current?.getBoundingClientRect().height ?? 0;
      void ads.showBanner(Math.max(0, barH - inset));
    });
    return () => {
      cancelled = true;
    };
  }, [active, premium]);

  // Leaving the signed-in area (sign-out, quiz, chat) hides the banner.
  useEffect(
    () => () => {
      void import('../native/ads').then((ads) => ads.hideBanner());
    },
    [],
  );

  return <div ref={probe} aria-hidden className="pointer-events-none fixed bottom-0 left-0 h-[env(safe-area-inset-bottom)] w-px" />;
}
