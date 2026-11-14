/**
 * Google Play purchases, through RevenueCat.
 *
 * The Android app buys Premium with Play Billing via the RevenueCat SDK. The app is never trusted to say
 * "I paid": Premium is set here, either when RevenueCat calls the webhook or when the app asks for a sync
 * right after a purchase. In both cases the end date is read from RevenueCat's API with the secret key.
 *
 * Environment (all optional; without REVENUECAT_WEBHOOK_AUTH the webhook answers 404):
 *   REVENUECAT_WEBHOOK_AUTH   the exact "Authorization header value" entered for the webhook in RevenueCat
 *   REVENUECAT_SECRET_KEY     RevenueCat secret API key (sk_…), used to read a customer's entitlement
 *   REVENUECAT_ENTITLEMENT    entitlement identifier that means Premium (default: premium)
 */
import { Router, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { q } from '../db.js';
import { isPremium } from '../profiles.js';
import { loadUser, me } from './common.js';

export const billing = Router();

const LIFETIME = new Date('2100-01-01T00:00:00Z');

/**
 * Records the store's Premium end date for a user and folds it into premium_until.
 * premium_until follows the store date while it came from the store (so renewals extend it and refunds or
 * expiry end it), but Premium granted on the website or by an admin that runs longer is never shortened.
 */
async function applyStoreExpiry(uid: string, expires: Date | null) {
  const r = await q<{ premium_until: Date | null }>(
    `UPDATE users SET
       premium_until = CASE
         WHEN premium_until IS NULL OR (store_premium_until IS NOT NULL AND premium_until <= store_premium_until) THEN $2::timestamptz
         ELSE greatest(premium_until, coalesce($2::timestamptz, premium_until))
       END,
       store_premium_until = $2::timestamptz
     WHERE id=$1 RETURNING premium_until`,
    [uid, expires],
  );
  return r.rows[0]?.premium_until ?? null;
}

/** Reads the Premium entitlement for one customer from RevenueCat. Returns undefined when it can't be read. */
async function fetchStoreExpiry(uid: string): Promise<Date | null | undefined> {
  if (!config.revenuecat.secretKey) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${config.revenuecat.secretKey}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error('[billing] RevenueCat lookup failed', res.status);
      return undefined;
    }
    const data: any = await res.json();
    const ent = data?.subscriber?.entitlements?.[config.revenuecat.entitlement];
    if (!ent) return null;
    if (!ent.expires_date) return LIFETIME;
    const d = new Date(ent.expires_date);
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch (e: any) {
    console.error('[billing] RevenueCat lookup error', e?.message || e);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Brings one user's Premium in line with RevenueCat. Returns false when RevenueCat couldn't be asked. */
async function syncUser(uid: string) {
  const expires = await fetchStoreExpiry(uid);
  if (expires === undefined) return false;
  await applyStoreExpiry(uid, expires);
  return true;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Events that carry no change to what the customer is entitled to. */
const IGNORED = new Set(['TEST', 'BILLING_ISSUE', 'SUBSCRIBER_ALIAS', 'SUBSCRIPTION_PAUSED', 'INVOICE_ISSUANCE', 'VIRTUAL_CURRENCY_TRANSACTION', 'EXPERIMENT_ENROLLMENT']);

/** POST /api/webhooks/revenuecat — called by RevenueCat, not by the app. */
export async function revenuecatWebhook(req: Request, res: Response) {
  const expected = config.revenuecat.webhookAuth;
  if (!expected) return res.status(404).json({ error: 'Not found', code: 'not_found' });
  if (!safeEqual(String(req.headers.authorization || ''), expected)) return res.status(401).json({ error: 'Unauthorized' });

  const ev: any = req.body?.event;
  if (!ev || typeof ev !== 'object' || typeof ev.type !== 'string') return res.status(400).json({ error: 'Malformed event' });
  const type = ev.type.toUpperCase();

  // A purchase can be attached to more than one id (aliases, transfers between accounts); only real accounts matter.
  const candidates = [ev.app_user_id, ev.original_app_user_id, ...(Array.isArray(ev.aliases) ? ev.aliases : []), ...(Array.isArray(ev.transferred_to) ? ev.transferred_to : []), ...(Array.isArray(ev.transferred_from) ? ev.transferred_from : [])]
    .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && !v.startsWith('$RCAnonymousID'));
  const ids = [...new Set(candidates)];
  const known = ids.length ? (await q<{ id: string }>('SELECT id FROM users WHERE id = ANY($1::text[])', [ids])).rows.map((r) => r.id) : [];

  await q(
    `INSERT INTO store_events (id, user_id, type, product, environment, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [String(ev.id || `${type}:${ev.event_timestamp_ms || Date.now()}`).slice(0, 200), known[0] || null, type, String(ev.product_id || '').slice(0, 200), String(ev.environment || '').slice(0, 40), ev.expiration_at_ms ? new Date(Number(ev.expiration_at_ms)) : null],
  );

  if (IGNORED.has(type) || known.length === 0) return res.json({ ok: true });

  if (config.revenuecat.secretKey) {
    // Preferred: ask RevenueCat for the current state, so late or out-of-order events can't leave Premium wrong.
    const results = await Promise.all(known.map(syncUser));
    if (results.some((ok) => !ok)) return res.status(503).json({ error: 'Could not confirm with RevenueCat, please retry' });
  } else if (type !== 'TRANSFER') {
    // Fallback without the secret key: trust the signed-off event itself.
    const ents: string[] = Array.isArray(ev.entitlement_ids) ? ev.entitlement_ids : ev.entitlement_id ? [ev.entitlement_id] : [];
    if (ents.includes(config.revenuecat.entitlement)) {
      const expires = ev.expiration_at_ms ? new Date(Number(ev.expiration_at_ms)) : type === 'EXPIRATION' ? new Date() : LIFETIME;
      await applyStoreExpiry(known[0], expires);
    }
  }
  res.json({ ok: true });
}

/** POST /api/billing/sync — the app calls this right after a purchase or restore, so Premium shows at once. */
billing.post('/billing/sync', async (req, res) => {
  const u = await me(req, { requireProfile: false });
  const synced = await syncUser(u.id);
  const fresh = (await loadUser(u.id)) || u;
  res.json({ synced, premium: isPremium(fresh), premiumUntil: fresh.premium_until });
});
