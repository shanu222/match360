import { Resend } from 'resend';
import { config } from './config.js';
import { q } from './db.js';

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;
if (!resend) console.warn('[email] RESEND_API_KEY missing — email notifications disabled');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string, ctaText: string, ctaPath: string) {
  return layoutLink(title, bodyHtml, ctaText, `${config.appUrl}${ctaPath}`);
}
function layoutLink(title: string, bodyHtml: string, ctaText: string, url: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F5F6FA;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#101935">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDE1EC">
    <tr><td style="padding:22px 28px;border-bottom:1px solid #DDE1EC;color:#101935;font-size:20px;font-weight:700;letter-spacing:-.4px"><span style="display:inline-block;width:14px;height:14px;border:3px solid #2541D8;border-radius:50%;vertical-align:-2px"></span><span style="display:inline-block;width:14px;height:14px;border:3px solid #2541D8;border-radius:50%;margin-left:-8px;vertical-align:-2px;margin-right:8px"></span>match360</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3">${esc(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#5B6380">${bodyHtml}</div>
      <a href="${url}" style="display:inline-block;margin-top:22px;background:#2541D8;color:#fff;text-decoration:none;font-weight:600;padding:13px 24px;border-radius:10px">${esc(ctaText)}</a>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#5B6380">You’re receiving this because email notifications are on. Turn them off anytime in <a href="${config.appUrl}/settings" style="color:#2541D8">Settings</a>.</td></tr>
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

/** For sign-in emails (verify, reset): sent straight to the address, ignoring notification preferences. */
export async function sendAuthEmail(to: string, kind: 'verify' | 'reset', link: string) {
  if (!resend) throw new Error('Email is not configured');
  const html =
    kind === 'verify'
      ? layoutLink('Confirm your email', '<p>Tap the button to confirm this email address for your Match360 account.</p><p>If you didn’t create an account, you can ignore this email.</p>', 'Confirm email', link)
      : layoutLink('Reset your password', '<p>Tap the button to choose a new password. The link expires in one hour.</p><p>If you didn’t ask for this, you can ignore this email; your password won’t change.</p>', 'Choose a new password', link);
  const { error } = await resend.emails.send({ from: config.resend.from, to, subject: kind === 'verify' ? 'Confirm your email for Match360' : 'Reset your Match360 password', html });
  if (error) throw new Error(error.message);
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

const p = (t: string) => `<p>${t}</p>`;

/* ---------- Emails to the team (new report, verification request, direct payment) ---------- */
function adminLayout(title: string, bodyHtml: string, cta?: { text: string; url: string }) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F5F6FA;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#101935">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDE1EC">
    <tr><td style="padding:18px 28px;background:#101935;color:#ffffff;font-size:16px;font-weight:700">Match360 admin</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${esc(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#101935">${bodyHtml}</div>
      ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:22px;background:#2541D8;color:#fff;text-decoration:none;font-weight:600;padding:13px 24px;border-radius:10px">${esc(cta.text)}</a>` : ''}
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #eee;font-size:12px;color:#5B6380">Sent to the Match360 team address. Change it with the ADMIN_NOTIFY_EMAIL variable on the server.</td></tr>
  </table></td></tr></table></body></html>`;
}
const rows = (pairs: [string, string][]) =>
  `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">${pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#5B6380;white-space:nowrap;vertical-align:top;border-bottom:1px solid #EEF0F6">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #EEF0F6">${esc(v)}</td></tr>`)
    .join('')}</table>`;
const panel = (path: string) => (config.adminPanelUrl ? { text: 'Open in admin', url: `${config.adminPanelUrl}/${path}` } : undefined);

async function sendAdmin(subject: string, html: string, attachments?: { filename: string; content: Buffer; contentType?: string; contentId?: string }[]) {
  if (!resend || !config.adminNotifyEmail) return;
  try {
    const { error } = await resend.emails.send({ from: config.resend.from, to: config.adminNotifyEmail, subject, html, attachments });
    if (error) console.warn('[email] admin send failed', error.message);
  } catch (e: any) {
    console.warn('[email] admin error', e?.message);
  }
}

// All senders are fire-and-forget: callers never await failures into the request path.
export const emails = {
  newRequest(toId: string, fromName: string, score: number) {
    void send(
      toId,
      `${fromName} wants to connect with you`,
      layout(
        `${fromName} wants to connect`,
        `<p><b>${esc(fromName)}</b> read your profile, answered questions about you and got <b>${score}%</b> right.</p><p>To accept, read ${esc(fromName)}’s profile and answer a few questions about them. Your result is shared back.</p>`,
        'Review request',
        '/requests',
      ),
    );
  },
  accepted(toId: string, byName: string, theirScore: number, matchId: string) {
    void send(
      toId,
      `You're connected with ${byName}`,
      layout(
        `${byName} accepted your request`,
        `<p><b>${esc(byName)}</b> answered questions about you and got <b>${theirScore}%</b> right. You can now message each other.</p>`,
        'Say hello',
        `/chats/${matchId}`,
      ),
    );
  },
  welcome(toId: string, name: string) {
    void send(
      toId,
      'Welcome to Match360',
      layout(`Welcome, ${name}`, p('Your profile is live. Browse people, read their profiles carefully, and connect when someone stands out.') + p('Tip: verified profiles get more requests. You can verify your identity from Settings.'), 'Start exploring', '/discover'),
    );
  },
  verification(toId: string, approved: boolean, note: string) {
    void send(
      toId,
      approved ? 'Your profile is verified' : 'We couldn’t verify your profile',
      layout(
        approved ? 'You’re verified' : 'Verification needs another try',
        approved ? p('Your identity was confirmed. A verified badge now shows on your profile.') : p('We couldn’t confirm your identity from the documents you sent.') + (note ? p(`Reason: ${esc(note)}`) : '') + p('Please correct this and submit new photos from Settings, under Identity verification.'),
        approved ? 'View my profile' : 'Try again',
        approved ? '/me' : '/verify',
      ),
    );
  },
  payment(toId: string, approved: boolean, planName: string, until: Date | null, note: string) {
    void send(
      toId,
      approved ? 'Your Premium is active' : 'We couldn’t confirm your payment',
      layout(
        approved ? 'Premium is active' : 'Payment not confirmed',
        approved
          ? p(`Thank you. ${esc(planName)} is active${until ? ` until ${until.toDateString()}` : ''}.`)
          : p('We couldn’t match your payment with our records.') + (note ? p(`Reason: ${esc(note)}`) : '') + p('If you did pay, reply to this email with your receipt.'),
        approved ? 'Open Match360' : 'View payment',
        approved ? '/discover' : '/premium',
      ),
    );
  },
  premiumGranted(toId: string, months: number, until: Date | null) {
    void send(
      toId,
      'You have Match360 Premium',
      layout('Premium is active', p(`The Match360 team has given your account Premium for ${months === 12 ? '1 year' : months === 1 ? '1 month' : `${months} months`}${until ? `. It is active until ${until.toDateString()}` : ''}.`) + p('It works on the website and in the app with this account.'), 'Open Match360', '/discover'),
    );
  },
  /** Team: a member sent a direct payment. The slip is shown in the email and the button opens the review page. */
  adminPayment(d: { member: string; email: string; plan: string; amount: string; method: string; reference: string; sender: string }, reviewUrl: string, slip: { bytes: Buffer; contentType: string } | null) {
    const ext = slip?.contentType.includes('png') ? 'png' : slip?.contentType.includes('webp') ? 'webp' : 'jpg';
    void sendAdmin(
      `Payment to confirm: ${d.amount} from ${d.member || d.email}`,
      adminLayout(
        'A payment is waiting for you',
        rows([['Member', `${d.member || 'No name yet'} (${d.email})`], ['Plan', d.plan], ['Amount', d.amount], ['Paid by', d.method], ['Transaction ID', d.reference], ['Sender', d.sender]]) +
          (slip ? `<p style="margin:18px 0 6px;color:#5B6380;font-size:13px">Payment slip</p><img src="cid:slip" alt="Payment slip" style="max-width:100%;border-radius:10px;border:1px solid #DDE1EC" />` : '<p style="margin-top:18px;color:#5B6380">No slip was attached.</p>') +
          '<p style="margin-top:18px;color:#5B6380;font-size:13px">Check the transaction in your Easypaisa, JazzCash or bank account before approving. The button opens a page where you approve or reject it; the link works for 14 days.</p>',
        { text: 'Review and approve', url: reviewUrl },
      ),
      slip ? [{ filename: `slip.${ext}`, content: slip.bytes, contentType: slip.contentType, contentId: 'slip' }] : undefined,
    );
  },
  adminReport(d: { reported: string; reportedEmail: string; reporter: string; reason: string; details: string; total: number }) {
    void sendAdmin(
      `New report: ${d.reason} (${d.reported || 'member'})`,
      adminLayout('A member was reported', rows([['Reported member', `${d.reported || 'No name yet'} (${d.reportedEmail})`], ['Reported by', d.reporter], ['Reason', d.reason], ['What happened', d.details], ['Reports against this member', String(d.total)]]), panel('reports')),
    );
  },
  adminVerification(d: { member: string; email: string; docType: string }) {
    void sendAdmin(
      `Verification to review: ${d.member || d.email}`,
      adminLayout('A member asked to be verified', rows([['Member', `${d.member || 'No name yet'} (${d.email})`], ['Document', d.docType]]) + '<p style="margin-top:14px;color:#5B6380;font-size:13px">Documents are only shown inside the admin panel.</p>', panel('verifications')),
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
