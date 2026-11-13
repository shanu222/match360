/**
 * Google Play Billing — not implemented yet. This file is the single place to add it.
 *
 * Google Play requires Play Billing for digital subscriptions sold inside the app, so the Android build
 * hides every manual payment method (see pages/Premium.tsx). Until billing is added here, Premium cannot
 * be bought in the app; members who already have Premium still get all of its benefits.
 *
 * To add it later:
 *  1. Play Console: create subscription products (e.g. premium_1m, premium_3m, premium_12m) with base plans.
 *  2. App: add a billing plugin (for example @capgo/native-purchases or RevenueCat), list the products,
 *     start the purchase flow from `purchasePremium`, and send the purchase token to the backend.
 *  3. Backend: add POST /api/payments/google that verifies the token with the Google Play Developer API
 *     (purchases.subscriptionsv2.get, using a service account linked in Play Console), sets premium_until,
 *     acknowledges the purchase, and handles Real-time Developer Notifications (renewals, cancellations,
 *     refunds) through a Pub/Sub push endpoint.
 *  4. Set `playBillingAvailable` to true; Premium.tsx then renders the purchase section.
 */
export const playBillingAvailable = false;

export interface PlayProduct { id: string; title: string; price: string }

export async function listPremiumProducts(): Promise<PlayProduct[]> {
  return [];
}

export async function purchasePremium(_productId: string): Promise<void> {
  throw new Error('Purchases are not available in the app yet.');
}
