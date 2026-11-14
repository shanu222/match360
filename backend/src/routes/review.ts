/**
 * Review page for one direct payment, opened from the button in the team's notification email.
 *
 * The link carries a signature that only this server can produce (see premium.ts), so it works without
 * signing in to the admin panel, for that one payment, for 14 days. Opening the link only shows the page:
 * approving or rejecting needs a button press, so mail scanners that preload links can't decide anything.
 */
import express, { Router, type Request, type Response } from 'express';
import { q } from '../db.js';
import { HttpError } from '../http.js';
import { decidePayment, reviewValid } from '../premium.js';
import { signPrivateGet } from '../storage.js';
import { isUuid, param } from './common.js';

export const review = Router();

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(res: Response, status: number, title: string, body: string) {
  res
    .status(status)
    .set('Content-Security-Policy', "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
    .set('Cache-Control', 'no-store')
    .set('X-Robots-Tag', 'noindex')
    .type('html')
    .send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
body{margin:0;background:#F5F6FA;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#101935;line-height:1.5}
main{max-width:560px;margin:0 auto;padding:24px 16px 48px}
.card{background:#fff;border:1px solid #DDE1EC;border-radius:16px;padding:22px}
h1{font-size:22px;margin:0 0 14px} .top{font-weight:700;margin:0 0 16px;color:#2541D8}
table{width:100%;border-collapse:collapse;font-size:15px} td{padding:8px 0;border-bottom:1px solid #EEF0F6;vertical-align:top} td:first-child{color:#5B6380;width:40%}
img{max-width:100%;border-radius:10px;border:1px solid #DDE1EC;margin-top:16px}
button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:13px 20px;cursor:pointer;width:100%;margin-top:12px}
.ok{background:#2541D8;color:#fff} .no{background:#fff;color:#C0392B;border:1px solid #E6B8B2}
textarea{font:inherit;width:100%;box-sizing:border-box;border:1px solid #DDE1EC;border-radius:10px;padding:10px;margin-top:8px;min-height:70px}
.muted{color:#5B6380;font-size:14px} .done{font-size:17px}
</style></head><body><main><p class="top">Match360 admin</p><div class="card">${body}</div></main></body></html>`);
}

const money = (amount: unknown, currency: string) => (currency === 'USD' ? `$${Number(amount).toFixed(2)}` : `Rs ${Math.round(Number(amount)).toLocaleString('en-US')}`);

async function load(req: Request) {
  const id = param(req, 'id');
  if (!isUuid(id) || !reviewValid(id, req.query.exp, req.query.sig)) throw new HttpError(403, 'This link is not valid or has expired. Open the admin panel to review the payment.');
  const p = (await q(`SELECT p.*, u.name, u.email FROM payments p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=$1`, [id])).rows[0];
  if (!p) throw new HttpError(404, 'This payment no longer exists.');
  return p;
}

const details = (p: any) =>
  `<table>
<tr><td>Member</td><td>${esc(p.name || 'No name yet')}<br><span class="muted">${esc(p.email || 'deleted account')}</span></td></tr>
<tr><td>Plan</td><td>${esc(p.plan)}</td></tr>
<tr><td>Amount</td><td><b>${esc(money(p.amount, p.currency))}</b></td></tr>
<tr><td>Paid by</td><td>${esc(p.method)}</td></tr>
<tr><td>Transaction ID</td><td>${esc(p.reference)}</td></tr>
${p.sender ? `<tr><td>Sender</td><td>${esc(p.sender)}</td></tr>` : ''}
<tr><td>Sent</td><td>${esc(new Date(p.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' }))} (Pakistan time)</td></tr>
</table>`;

review.get('/review/payment/:id', async (req, res) => {
  let p;
  try {
    p = await load(req);
  } catch (e: any) {
    return page(res, e?.status || 500, 'Payment review', `<h1>Can’t open this payment</h1><p>${esc(e?.message || 'Something went wrong.')}</p>`);
  }
  if (p.status !== 'pending') {
    return page(res, 200, 'Payment review', `<h1>Already ${esc(p.status)}</h1>${details(p)}<p class="muted" style="margin-top:14px">This payment was reviewed${p.reviewed_at ? ` on ${esc(new Date(p.reviewed_at).toLocaleDateString('en-GB', { dateStyle: 'medium' }))}` : ''}. Nothing more to do.</p>`);
  }
  const slip = await signPrivateGet(p.proof_key);
  page(
    res,
    200,
    'Payment review',
    `<h1>Confirm this payment</h1>${details(p)}
${slip ? `<img src="${esc(slip)}" alt="Payment slip">` : '<p class="muted">No slip was attached.</p>'}
<p class="muted" style="margin-top:16px">Check that this transaction reached your account before approving. Approving gives the member Premium for the length of the plan and emails them.</p>
<form method="post"><input type="hidden" name="decision" value="approve"><button class="ok">Approve and give Premium</button></form>
<form method="post"><input type="hidden" name="decision" value="reject"><textarea name="note" maxlength="300" placeholder="Reason for rejecting (sent to the member)" required minlength="5"></textarea><button class="no">Reject</button></form>`,
  );
});

review.post('/review/payment/:id', express.urlencoded({ extended: false, limit: '4kb' }), async (req, res) => {
  try {
    const p = await load(req);
    const decision = String(req.body?.decision || '');
    const note = String(req.body?.note || '').trim().slice(0, 300);
    if (decision !== 'approve' && decision !== 'reject') throw new HttpError(400, 'Choose approve or reject.');
    if (decision === 'reject' && note.length < 5) throw new HttpError(400, 'Write the reason for rejecting, so the member knows what to do.');
    const out = await decidePayment(p.id, decision === 'approve', note);
    await q('INSERT INTO admin_audit (action, target, details, ip) VALUES ($1,$2,$3,$4)', [`payment_${decision}`, p.user_id, JSON.stringify({ amount: Number(p.amount), currency: p.currency, reference: p.reference, via: 'email link' }), req.ip]).catch(() => {});
    page(
      res,
      200,
      'Payment review',
      decision === 'approve'
        ? `<h1>Approved</h1><p class="done">${esc(p.name || p.email || 'The member')} now has Premium${out.until ? ` until <b>${esc(new Date(out.until).toLocaleDateString('en-GB', { dateStyle: 'long' }))}</b>` : ''}.</p><p class="muted">They have been told by email and in the app. You can close this page.</p>`
        : `<h1>Rejected</h1><p class="done">The member has been told, with your reason.</p><p class="muted">You can close this page.</p>`,
    );
  } catch (e: any) {
    page(res, e?.status || 500, 'Payment review', `<h1>Not done</h1><p>${esc(e?.status ? e.message : 'Something went wrong. Please try again from the admin panel.')}</p>`);
  }
});
