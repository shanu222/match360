/**
 * Premium given by the team, and direct payments (Easypaisa, JazzCash, bank transfer) that a person confirms.
 * Google Play purchases never come through here: see routes/billing.ts.
 *
 * Shared by the admin panel and by the review link in the admin's notification email, so a payment is
 * approved or rejected the same way wherever the decision is made.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { q, tx } from './db.js';
import { bad } from './http.js';
import { emails } from './email.js';
import { notify } from './realtime.js';
import { serverSecret } from './settings.js';

const day = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Approves or rejects a pending direct payment. Approval adds the plan's months to the member's Premium. */
export async function decidePayment(id: string, approved: boolean, note: string) {
  const out = await tx(async (c) => {
    const p = (await c.query(`UPDATE payments SET status=$2, note=$3, reviewed_at=now() WHERE id=$1 AND status='pending' RETURNING *`, [id, approved ? 'approved' : 'rejected', note])).rows[0];
    if (!p) throw bad('This payment was already reviewed');
    let until: Date | null = null;
    if (approved && p.user_id) {
      until = (
        await c.query(`UPDATE users SET premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(months => $2) WHERE id=$1 RETURNING premium_until`, [p.user_id, p.months])
      ).rows[0]?.premium_until;
    }
    return { p, until };
  });
  if (out.p.user_id) {
    emails.payment(out.p.user_id, approved, out.p.plan, out.until, note);
    void notify(
      out.p.user_id,
      'premium',
      approved ? `Your payment was confirmed. Premium is active until ${day(out.until)}.` : `We couldn’t confirm your payment${note ? `: ${note}` : '.'} Open Premium to send it again.`,
    );
  }
  return out;
}

/** Gives Premium for a number of months without a payment record (admin decision). */
export async function grantPremium(userId: string, months: number) {
  const until: Date | null =
    (await q(`UPDATE users SET premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(months => $2) WHERE id=$1 RETURNING premium_until`, [userId, months])).rows[0]?.premium_until ?? null;
  emails.premiumGranted(userId, months, until);
  void notify(userId, 'premium', `You’ve been given Match360 Premium. It is active until ${day(until)}.`);
  return until;
}

/* ---------- Review link sent to the admin by email ---------- */
const REVIEW_TTL_MS = 14 * 24 * 3600_000;
const sign = (id: string, exp: number) => createHmac('sha256', `review|${serverSecret()}`).update(`${id}|${exp}`).digest('base64url');

/** Query string that lets whoever holds the email open the review page for one payment, for 14 days. */
export function reviewQuery(paymentId: string) {
  const exp = Date.now() + REVIEW_TTL_MS;
  return `exp=${exp}&sig=${sign(paymentId, exp)}`;
}
export function reviewValid(paymentId: string, exp: unknown, sig: unknown) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now() || typeof sig !== 'string') return false;
  const want = Buffer.from(sign(paymentId, e));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
