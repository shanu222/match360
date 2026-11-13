/**
 * AdMob IDs — the single place they are configured.
 *
 * Defaults are Google's official TEST IDs, which are safe to ship and always return test ads.
 * To use real ads, add these three lines to frontend/.env.android and rebuild (npm run android:release):
 *
 *   VITE_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY          (AdMob > Apps > App settings > App ID)
 *   VITE_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ       (banner ad unit)
 *   VITE_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWW (interstitial ad unit)
 *
 * The App ID is read from the same file by android/app/build.gradle and written into AndroidManifest.xml.
 */
export const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

const valid = (v: string | undefined) => (v && /^ca-app-pub-\d+\/\d+$/.test(v.trim()) ? v.trim() : '');

const banner = valid(import.meta.env.VITE_ADMOB_BANNER_ID);
const interstitial = valid(import.meta.env.VITE_ADMOB_INTERSTITIAL_ID);

export const ADS = {
  bannerId: banner || TEST_BANNER_ID,
  interstitialId: interstitial || TEST_INTERSTITIAL_ID,
  /** True while either unit still uses a Google test ID. */
  bannerIsTest: !banner,
  interstitialIsTest: !interstitial,
  /** Minimum gap between two interstitials. */
  interstitialGapMs: 4 * 60_000,
  /** No interstitial this soon after the app starts. */
  interstitialWarmupMs: 60_000,
  /** Routes that show the banner above the tab bar. */
  bannerRoutes: ['/discover', '/requests', '/me'],
};
