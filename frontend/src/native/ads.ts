/**
 * AdMob for the Android app. Only loaded when VITE_PLATFORM=android, and only started for free members.
 * Every call is wrapped so that an ad failure can never block or break the UI.
 */
import { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { ADS } from './adsConfig';

const startedAt = Date.now();
let initPromise: Promise<boolean> | null = null;
let canRequestAds = false;
let bannerShown = false; // a banner view exists (visible or hidden)
let bannerVisible = false;
let interstitialReady = false;
let interstitialLoading = false;
let lastInterstitial = 0;
let allowed = false; // false for Premium members and signed-out users

const setAdHeight = (px: number) => document.documentElement.style.setProperty('--ad-h', `${Math.max(0, Math.round(px))}px`);

async function gatherConsent() {
  // Google UMP: required before requesting ads for EEA/UK users; a no-op elsewhere.
  try {
    let info = await AdMob.requestConsentInfo();
    if (!info.canRequestAds && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
    canRequestAds = info.canRequestAds;
  } catch (e) {
    // No consent message has been created for this app in AdMob (Privacy & messaging), so there is
    // nothing to ask. Ads can still be requested; any other failure (e.g. network) keeps ads off.
    const msg = String((e as { message?: unknown })?.message ?? e);
    if (!/misconfigur|no form\(s\) configured/i.test(msg)) throw e;
    console.warn('[ads] no consent message configured in AdMob; continuing without one');
    canRequestAds = true;
  }
}

/** Initialises the SDK and consent once. Resolves to whether ads may be requested. */
export function initAds(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await AdMob.initialize();
        await gatherConsent();
        AdMob.addListener(BannerAdPluginEvents.SizeChanged, (s) => bannerVisible && setAdHeight(s.height)).catch(() => {});
        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => setAdHeight(0)).catch(() => {});
        AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => { interstitialReady = true; interstitialLoading = false; }).catch(() => {});
        AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => { interstitialReady = false; interstitialLoading = false; }).catch(() => {});
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => { interstitialReady = false; preloadInterstitial(); }).catch(() => {});
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => { interstitialReady = false; }).catch(() => {});
        if (canRequestAds) preloadInterstitial();
        return canRequestAds;
      } catch (e) {
        console.warn('[ads] init failed', e);
        return false;
      }
    })();
  }
  return initPromise;
}

/** Shows (or re-shows) the adaptive banner `marginBottom` CSS pixels above the bottom edge. */
export async function showBanner(marginBottom: number) {
  allowed = true;
  try {
    if (!(await initAds()) || !allowed) return;
    if (bannerShown) {
      await AdMob.resumeBanner();
    } else {
      bannerShown = true;
      await AdMob.showBanner({
        adId: ADS.bannerId,
        isTesting: ADS.bannerIsTest,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: Math.round(marginBottom),
      });
    }
    bannerVisible = true;
  } catch (e) {
    bannerShown = false;
    bannerVisible = false;
    setAdHeight(0);
    console.warn('[ads] banner failed', e);
  }
}

export async function hideBanner() {
  bannerVisible = false;
  setAdHeight(0);
  if (!bannerShown) return;
  try {
    await AdMob.hideBanner();
  } catch {
    /* nothing to hide */
  }
}

/** Removes every ad. Called when the member becomes Premium or signs out. */
export async function removeAds() {
  allowed = false;
  bannerVisible = false;
  setAdHeight(0);
  if (!bannerShown) return;
  bannerShown = false;
  try {
    await AdMob.removeBanner();
  } catch {
    /* already gone */
  }
}

function preloadInterstitial() {
  if (!canRequestAds || interstitialReady || interstitialLoading) return;
  interstitialLoading = true;
  AdMob.prepareInterstitial({ adId: ADS.interstitialId, isTesting: ADS.interstitialIsTest }).catch(() => {
    interstitialLoading = false;
  });
}

/**
 * Shows an interstitial at a natural break, if one is loaded and the frequency cap allows it.
 * Never awaits a network load, so it cannot delay navigation.
 */
export function maybeShowInterstitial() {
  const now = Date.now();
  if (!allowed || !canRequestAds) return;
  if (now - startedAt < ADS.interstitialWarmupMs || now - lastInterstitial < ADS.interstitialGapMs) return;
  if (!interstitialReady) return preloadInterstitial();
  lastInterstitial = now;
  interstitialReady = false;
  AdMob.showInterstitial().catch(() => preloadInterstitial());
}

/** Reopens Google's privacy/consent form. Returns false when no choices apply in the user's region. */
export async function openPrivacyChoices(): Promise<boolean> {
  try {
    await AdMob.initialize().catch(() => {});
    const info = await AdMob.requestConsentInfo();
    if (String(info.privacyOptionsRequirementStatus) !== 'REQUIRED') return false;
    await AdMob.showPrivacyOptionsForm();
    canRequestAds = (await AdMob.requestConsentInfo()).canRequestAds;
    return true;
  } catch {
    return false;
  }
}
