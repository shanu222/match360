/**
 * Google Play Billing for the Android app, through RevenueCat.
 *
 * Google Play requires Play Billing for digital subscriptions sold inside the app, so the Android build
 * never shows the website's manual payment methods (see pages/Premium.tsx). Plans and prices come from the
 * current RevenueCat offering, so they are changed in Play Console and RevenueCat, not in this code.
 *
 * Premium itself is granted by the backend, never by the app: RevenueCat calls the backend webhook
 * (POST /api/webhooks/revenuecat) and the backend sets the Premium end date after checking with RevenueCat.
 * The key below is RevenueCat's public SDK key, which is meant to ship inside the app.
 */
import { isAndroidApp } from '../lib/platform';

const KEY = String(import.meta.env.VITE_REVENUECAT_ANDROID_KEY || '').trim();
/** RevenueCat entitlement that means "has Premium". Must match the backend (REVENUECAT_ENTITLEMENT). */
export const ENTITLEMENT = 'premium';
/** Only a Play Store key enables purchases; a RevenueCat Test Store key (test_…) must never ship. */
export const playBillingAvailable = isAndroidApp && KEY.startsWith('goog_');
export const MANAGE_URL = 'https://play.google.com/store/account/subscriptions?package=com.sustainablesolution360.match360';

export interface PlayPlan {
  id: string; // RevenueCat package identifier
  name: string;
  price: string; // localised by Google Play, e.g. "Rs 500.00"
  period: string; // "month", "3 months", "year"…
  perMonth: string | null;
  recurring: boolean;
}

const sdk = () => import('@revenuecat/purchases-capacitor').then((m) => m.Purchases);
let configuredFor: string | null = null;
let setup: Promise<void> = Promise.resolve();
const packages = new Map<string, unknown>();

/** Configures the SDK once, and keeps it signed in as the current Match360 account. */
function ready(userId: string): Promise<void> {
  setup = setup
    .catch(() => {})
    .then(async () => {
      if (!playBillingAvailable) throw new Error('Purchases are not available in the app yet.');
      if (configuredFor === userId) return;
      const Purchases = await sdk();
      if (configuredFor === null && !(await Purchases.isConfigured()).isConfigured) await Purchases.configure({ apiKey: KEY, appUserID: userId });
      else await Purchases.logIn({ appUserID: userId });
      configuredFor = userId;
    });
  return setup;
}

const LABELS: Record<string, [name: string, period: string]> = {
  WEEKLY: ['Weekly', 'week'],
  MONTHLY: ['Monthly', 'month'],
  TWO_MONTH: ['2 months', '2 months'],
  THREE_MONTH: ['3 months', '3 months'],
  SIX_MONTH: ['6 months', '6 months'],
  ANNUAL: ['Yearly', 'year'],
  LIFETIME: ['Lifetime', ''],
};

export async function listPremiumPlans(userId: string): Promise<PlayPlan[]> {
  await ready(userId);
  const offerings = await (await sdk()).getOfferings();
  packages.clear();
  return (offerings.current?.availablePackages || []).map((p) => {
    packages.set(p.identifier, p);
    const [name, period] = LABELS[String(p.packageType)] || [p.product.title.replace(/\s*\(.*\)\s*$/, '') || 'Premium', ''];
    const recurring = String(p.packageType) !== 'LIFETIME';
    return { id: p.identifier, name, price: p.product.priceString, period, perMonth: recurring && String(p.packageType) !== 'MONTHLY' ? p.product.pricePerMonthString : null, recurring };
  });
}

const cancelled = (e: any) => e?.userCancelled === true || String(e?.code) === '1' || /cancel/i.test(String(e?.message || ''));

/** Opens Google Play's purchase sheet. Resolves to false when the user closes it without buying. */
export async function purchasePremium(userId: string, planId: string): Promise<boolean> {
  await ready(userId);
  const aPackage = packages.get(planId);
  if (!aPackage) throw new Error('That plan is no longer available. Please reopen this page.');
  try {
    await (await sdk()).purchasePackage({ aPackage: aPackage as never });
    return true;
  } catch (e) {
    if (cancelled(e)) return false;
    throw new Error(String((e as any)?.message || 'The purchase didn’t go through. You have not been charged.'));
  }
}

/** Re-attaches a subscription bought earlier with the same Google account. Resolves to whether one was found. */
export async function restorePremium(userId: string): Promise<boolean> {
  await ready(userId);
  const { customerInfo } = await (await sdk()).restorePurchases();
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT]);
}

/** Called on sign-out so the next account on this phone doesn't inherit the previous one's purchases. */
export async function signOutBilling(): Promise<void> {
  if (configuredFor === null) return;
  configuredFor = null;
  try {
    const Purchases = await sdk();
    if (!(await Purchases.isAnonymous()).isAnonymous) await Purchases.logOut();
  } catch {
    /* nothing to sign out of */
  }
}
