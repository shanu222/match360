import { Resend } from 'resend';
import { config } from './config.js';
import { q } from './db.js';

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;
if (!resend) console.warn('[email] RESEND_API_KEY missing — email notifications disabled');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string, ctaText: string, ctaPath: string) {
  const url = `${config.appUrl}${ctaPath}`;
  return `<!DOCTYPE html><html><body style="margin:0;background:#f5f3fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d1928">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px rgba(40,20,80,.08)">
    <tr><td style="background:linear-gradient(135deg,#ff5f6d,#8b5cf6);padding:22px 28px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.3px">Match360</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3">${esc(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#4a4458">${bodyHtml}</div>
      <a href="${url}" style="display:inline-block;margin-top:22px;background:linear-gradient(135deg,#ff5f6d,#8b5cf6);color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:12px">${esc(ctaText)}</a>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#8a8399">You’re receiving this because email notifications are on. Turn them off anytime in <a href="${config.appUrl}/settings" style="color:#8b5cf6">Settings</a>.</td></tr>
  </table></td></tr></table></body></html>`;
}

async function getRecipient(userId: string) {
  const r = await q<{ email: string; name: string; email_notifications: boolean }>(
    'SELECT email, name, email_notifications FROM users WHERE id=$1',
    [userId],
  );
  const u = r.rows[0];
  if (!u || !u.email || !u.email_notifications) return null;
  return u;
}

/** Returns true if this (user,key) hasn't been emailed within `windowMinutes` and records the send. */
async function throttle(userId: string, key: string, windowMinutes: number) {
  const r = await q(
    `INSERT INTO email_log (user_id, key, sent_at) VALUES ($1,$2,now())
     ON CONFLICT (user_id, key) DO UPDATE SET sent_at = now()
     WHERE email_log.sent_at < now() - make_interval(mins => $3)
     RETURNING 1`,
    [userId, key, windowMinutes],
  );
  return (r.rowCount ?? 0) > 0;
}

async function send(userId: string, subject: string, html: string, throttleKey?: string, windowMinutes = 0) {
  if (!resend) return;
  try {
    const u = await getRecipient(userId);
    if (!u) return;
    if (throttleKey && !(await throttle(userId, throttleKey, windowMinutes))) return;
    const { error } = await resend.emails.send({ from: config.resend.from, to: u.email, subject, html });
    if (error) console.warn('[email] send failed', error.message);
  } catch (e: any) {
    console.warn('[email] error', e?.message);
  }
}

// All senders are fire-and-forget: callers never await failures into the request path.
export const emails = {
  newRequest(toId: string, fromName: string, score: number) {
    void send(
      toId,
      `${fromName} took your challenge and scored ${score}%`,
      layout(
        `${fromName} wants to connect`,
        `<p><b>${esc(fromName)}</b> answered questions about your profile and scored <b>${score}%</b>.</p><p>To accept, take a short quiz about ${esc(fromName)} — your score is shared back with them.</p>`,
        'Review request',
        '/challenges',
      ),
    );
  },
  accepted(toId: string, byName: string, theirScore: number, matchId: string) {
    void send(
      toId,
      `You're connected with ${byName} 🎉`,
      layout(
        `${byName} accepted your request`,
        `<p><b>${esc(byName)}</b> scored <b>${theirScore}%</b> on your profile challenge. You can now message each other.</p>`,
        'Say hello',
        `/chats/${matchId}`,
      ),
    );
  },
  newMessage(toId: string, fromName: string, matchId: string) {
    // Only when the recipient is offline, and at most once per conversation every 6 hours.
    void send(
      toId,
      `New message from ${fromName}`,
      layout(
        `${fromName} sent you a message`,
        `<p>You have a new message waiting on Match360.</p>`,
        'Open chat',
        `/chats/${matchId}`,
      ),
      `msg:${matchId}`,
      360,
    );
  },
};
