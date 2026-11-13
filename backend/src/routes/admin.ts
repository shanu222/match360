import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { q, tx } from '../db.js';
import { HttpError, bad, notFound, parse } from '../http.js';
import { encrypt, getSetting, mask, serverSecret, setSetting, DEFAULTS, aiKey, type Provider } from '../settings.js';
import { signPrivateGet, deletePhotos, deletePrivate } from '../storage.js';
import { emails } from '../email.js';
import { clearStatusCache, deleteFirebaseUser, forgetUser } from '../auth.js';
import { isUuid, param } from './common.js';
import { ageFrom, isPremium, privateProfile, type UserRow } from '../profiles.js';
import { checkProviders, generateAIQuiz } from '../ai.js';
import { quizFacts } from '../quiz.js';
import { countryName } from '../geo.js';

export const admin = Router();
export const adminEnabled = () => Boolean(config.admin.email && config.admin.password.length >= 8);

/* ---------------- session tokens ---------------- */
const TTL_MS = 8 * 3600_000;
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', `admin|${serverSecret()}`).update(data).digest('base64url');

function issueToken() {
  const payload = b64(JSON.stringify({ sub: 'admin', exp: Date.now() + TTL_MS, n: randomBytes(8).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token: string) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p.sub === 'admin' && p.exp > Date.now();
  } catch {
    return false;
  }
}
const hash = (s: string) => scryptSync(s, 'm360-admin-salt', 32);
function safeEqual(a: string, b: string) {
  return timingSafeEqual(hash(a), hash(b));
}

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!adminEnabled()) return next(notFound());
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ') || !verifyToken(h.slice(7))) return next(new HttpError(401, 'Admin session expired. Sign in again.', 'admin_unauthenticated'));
  next();
}
async function audit(req: Request, action: string, target?: string, details: Record<string, unknown> = {}) {
  await q('INSERT INTO admin_audit (action, target, details, ip) VALUES ($1,$2,$3,$4)', [action, target || null, JSON.stringify(details), req.ip]).catch(() => {});
}

/* ---------------- login ---------------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
let failures = 0;
let lockedUntil = 0;

admin.post('/login', loginLimiter, async (req, res) => {
  if (!adminEnabled()) throw notFound();
  if (Date.now() < lockedUntil) throw new HttpError(429, 'Admin sign-in is temporarily locked. Try again later.', 'locked');
  const { email, password } = parse(z.object({ email: z.string().max(200), password: z.string().max(200) }), req.body);
  const ok = safeEqual(email.trim().toLowerCase(), config.admin.email) && safeEqual(password, config.admin.password);
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300)); // slow down guessing
  if (!ok) {
    failures++;
    if (failures >= 20) {
      lockedUntil = Date.now() + 30 * 60_000;
      failures = 0;
    }
    await audit(req, 'login_failed');
    throw new HttpError(401, 'Incorrect email or password', 'invalid_credentials');
  }
  failures = 0;
  await audit(req, 'login');
  res.json({ token: issueToken(), expiresIn: TTL_MS });
});

admin.use(requireAdmin);

/* ---------------- dashboard ---------------- */
admin.get('/stats', async (_req, res) => {
  const r = await q(`SELECT
    (SELECT count(*) FROM users)::int AS users,
    (SELECT count(*) FROM users WHERE onboarded)::int AS profiles,
    (SELECT count(*) FROM users WHERE created_at > now() - interval '24 hours')::int AS signups_24h,
    (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS signups_7d,
    (SELECT count(*) FROM users WHERE last_seen > now() - interval '24 hours')::int AS active_24h,
    (SELECT count(*) FROM users WHERE id_verified)::int AS verified,
    (SELECT count(*) FROM users WHERE premium_until > now())::int AS premium,
    (SELECT count(*) FROM users WHERE status <> 'active')::int AS suspended,
    (SELECT count(*) FROM requests WHERE status='accepted')::int AS connections,
    (SELECT count(*) FROM requests)::int AS requests,
    (SELECT count(*) FROM quiz_attempts WHERE submitted_at IS NOT NULL)::int AS challenges,
    (SELECT count(*) FROM quiz_attempts WHERE source <> 'rules' AND started_at > now() - interval '7 days')::int AS ai_quizzes_7d,
    (SELECT count(*) FROM messages)::int AS messages,
    (SELECT count(*) FROM reports WHERE status='open')::int AS open_reports,
    (SELECT count(*) FROM verifications WHERE status='pending')::int AS pending_verifications,
    (SELECT count(*) FROM payments WHERE status='pending')::int AS pending_payments,
    (SELECT coalesce(sum(amount),0) FROM payments WHERE status='approved' AND currency='PKR')::float AS revenue_pkr,
    (SELECT coalesce(sum(amount),0) FROM payments WHERE status='approved' AND currency='USD')::float AS revenue_usd`);
  const daily = await q(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM users WHERE created_at::date = d)::int AS signups,
      (SELECT count(*) FROM requests WHERE created_at::date = d)::int AS requests,
      (SELECT count(*) FROM requests WHERE responded_at::date = d AND status='accepted')::int AS connections
    FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`);
  res.json({ ...r.rows[0], daily: daily.rows });
});

/* ---------------- users ---------------- */
function adminUser(u: UserRow) {
  return { ...privateProfile(u), countryName: countryName(u.country), idVerified: u.id_verified, statusReason: u.status_reason, premium: isPremium(u), age: ageFrom(u.dob) };
}
admin.get('/users', async (req, res) => {
  const term = String(req.query.q || '').trim();
  const status = ['active', 'suspended', 'banned'].includes(String(req.query.status)) ? String(req.query.status) : null;
  const filter = String(req.query.filter || '');
  const page = Math.max(0, Number(req.query.page) || 0);
  const r = await q<UserRow & { total: number }>(
    `SELECT u.*, count(*) OVER()::int AS total FROM users u
     WHERE ($1 = '' OR u.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR u.city ILIKE '%'||$1||'%' OR u.id = $1)
       AND ($2::text IS NULL OR u.status=$2)
       AND ($3 <> 'premium' OR u.premium_until > now())
       AND ($3 <> 'verified' OR u.id_verified)
       AND ($3 <> 'incomplete' OR NOT u.onboarded)
     ORDER BY u.created_at DESC LIMIT 50 OFFSET $4`,
    [term, status, filter, page * 50],
  );
  res.json({ users: r.rows.map(adminUser), total: r.rows[0]?.total || 0, page });
});

admin.get('/users/:id', async (req, res) => {
  const id = param(req, 'id');
  const u = (await q<UserRow>('SELECT * FROM users WHERE id=$1', [id])).rows[0];
  if (!u) throw notFound('User not found');
  const [reportsAgainst, reportsBy, payments, verifications, counts] = await Promise.all([
    q(`SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id=r.reporter_id WHERE r.reported_id=$1 ORDER BY r.created_at DESC LIMIT 50`, [id]),
    q(`SELECT r.*, u.name AS reported_name FROM reports r LEFT JOIN users u ON u.id=r.reported_id WHERE r.reporter_id=$1 ORDER BY r.created_at DESC LIMIT 50`, [id]),
    q(`SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [id]),
    q(`SELECT id, doc_type, status, note, created_at, reviewed_at FROM verifications WHERE user_id=$1 ORDER BY created_at DESC`, [id]),
    q(`SELECT
        (SELECT count(*) FROM requests WHERE sender_id=$1)::int AS sent,
        (SELECT count(*) FROM requests WHERE receiver_id=$1)::int AS received,
        (SELECT count(*) FROM requests WHERE (sender_id=$1 OR receiver_id=$1) AND status='accepted')::int AS connections,
        (SELECT count(*) FROM messages WHERE sender_id=$1)::int AS messages,
        (SELECT count(*) FROM blocks WHERE blocked_id=$1)::int AS blocked_by`, [id]),
  ]);
  res.json({ user: adminUser(u), reportsAgainst: reportsAgainst.rows, reportsBy: reportsBy.rows, payments: payments.rows, verifications: verifications.rows, counts: counts.rows[0] });
});

const userPatch = z.object({
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  statusReason: z.string().max(300).optional(),
  idVerified: z.boolean().optional(),
  premiumDays: z.number().int().min(-3650).max(3650).optional(),
  removePremium: z.boolean().optional(),
  hidePhotos: z.boolean().optional(),
});
admin.patch('/users/:id', async (req, res) => {
  const id = param(req, 'id');
  const p = parse(userPatch, req.body);
  const u = (await q<UserRow>('SELECT * FROM users WHERE id=$1', [id])).rows[0];
  if (!u) throw notFound('User not found');
  if (p.status) {
    await q('UPDATE users SET status=$2, status_reason=$3 WHERE id=$1', [id, p.status, p.statusReason || '']);
    if (p.status !== 'active') await q(`UPDATE requests SET status='closed' WHERE (sender_id=$1 OR receiver_id=$1) AND status IN ('pending','accepted')`, [id]);
    clearStatusCache(id);
  }
  if (p.idVerified !== undefined) await q('UPDATE users SET id_verified=$2 WHERE id=$1', [id, p.idVerified]);
  if (p.premiumDays) await q(`UPDATE users SET premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => $2) WHERE id=$1`, [id, p.premiumDays]);
  if (p.removePremium) await q('UPDATE users SET premium_until=NULL WHERE id=$1', [id]);
  if (p.hidePhotos) {
    await q(`UPDATE users SET photos='{}', photos_blurred='{}' WHERE id=$1`, [id]);
    void deletePhotos([...u.photos, ...u.photos_blurred]);
  }
  await audit(req, 'user_update', id, p);
  const fresh = (await q<UserRow>('SELECT * FROM users WHERE id=$1', [id])).rows[0];
  res.json({ user: adminUser(fresh) });
});

admin.delete('/users/:id', async (req, res) => {
  const id = param(req, 'id');
  const u = (await q<UserRow>('SELECT * FROM users WHERE id=$1', [id])).rows[0];
  if (!u) throw notFound('User not found');
  const priv = await q(`SELECT doc_key AS k FROM verifications WHERE user_id=$1 UNION ALL SELECT selfie_key FROM verifications WHERE user_id=$1 UNION ALL SELECT proof_key FROM payments WHERE user_id=$1`, [id]);
  await q('DELETE FROM users WHERE id=$1', [id]);
  void deletePhotos([...u.photos, ...u.photos_blurred]);
  void deletePrivate(priv.rows.map((x) => x.k));
  forgetUser(id);
  clearStatusCache(id);
  await deleteFirebaseUser(id);
  await audit(req, 'user_delete', id, { email: u.email, name: u.name });
  res.json({ ok: true });
});

/* ---------------- reports ---------------- */
admin.get('/reports', async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
  const r = await q(
    `SELECT r.*, a.name AS reporter_name, a.email AS reporter_email, b.name AS reported_name, b.email AS reported_email, b.status AS reported_status,
       (SELECT count(*) FROM reports x WHERE x.reported_id=r.reported_id)::int AS total_reports
     FROM reports r LEFT JOIN users a ON a.id=r.reporter_id LEFT JOIN users b ON b.id=r.reported_id
     WHERE r.status=$1 ORDER BY r.created_at DESC LIMIT 200`,
    [status],
  );
  res.json({ reports: r.rows });
});
admin.patch('/reports/:id', async (req, res) => {
  const id = Number(param(req, 'id'));
  if (!Number.isInteger(id)) throw notFound();
  const p = parse(z.object({ status: z.enum(['open', 'resolved', 'dismissed']), note: z.string().max(500).default('') }), req.body);
  await q(`UPDATE reports SET status=$2, admin_note=$3, resolved_at = CASE WHEN $2='open' THEN NULL ELSE now() END WHERE id=$1`, [id, p.status, p.note]);
  await audit(req, 'report_update', String(id), p);
  res.json({ ok: true });
});

/* ---------------- verifications ---------------- */
admin.get('/verifications', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
  const r = await q(
    `SELECT v.*, u.name, u.email, u.dob, u.gender, u.city, u.country, u.photos FROM verifications v JOIN users u ON u.id=v.user_id
     WHERE v.status=$1 ORDER BY v.created_at ASC LIMIT 100`,
    [status],
  );
  const rows = await Promise.all(
    r.rows.map(async (v) => ({
      id: v.id, userId: v.user_id, name: v.name, email: v.email, age: ageFrom(v.dob), gender: v.gender, city: v.city, country: countryName(v.country),
      profilePhoto: v.photos?.[0] || null, docType: v.doc_type, status: v.status, note: v.note, createdAt: v.created_at, reviewedAt: v.reviewed_at,
      docUrl: await signPrivateGet(v.doc_key), selfieUrl: await signPrivateGet(v.selfie_key),
    })),
  );
  res.json({ verifications: rows });
});
admin.post('/verifications/:id/:decision', async (req, res) => {
  const id = param(req, 'id');
  const decision = param(req, 'decision');
  if (!isUuid(id) || !['approve', 'reject'].includes(decision)) throw notFound();
  const { note } = parse(z.object({ note: z.string().max(300).default('') }), req.body);
  const approved = decision === 'approve';
  const v = await tx(async (c) => {
    const row = (await c.query(`UPDATE verifications SET status=$2, note=$3, reviewed_at=now() WHERE id=$1 AND status='pending' RETURNING *`, [id, approved ? 'approved' : 'rejected', note])).rows[0];
    if (!row) throw bad('This request was already reviewed');
    if (approved) await c.query('UPDATE users SET id_verified=true WHERE id=$1', [row.user_id]);
    return row;
  });
  emails.verification(v.user_id, approved, note);
  await audit(req, `verification_${decision}`, v.user_id, { note });
  res.json({ ok: true });
});

/* ---------------- payments ---------------- */
admin.get('/payments', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
  const r = await q(
    `SELECT p.*, u.name, u.email, u.premium_until FROM payments p LEFT JOIN users u ON u.id=p.user_id WHERE p.status=$1 ORDER BY p.created_at ASC LIMIT 200`,
    [status],
  );
  const rows = await Promise.all(r.rows.map(async (p) => ({ ...p, amount: Number(p.amount), proofUrl: await signPrivateGet(p.proof_key) })));
  res.json({ payments: rows });
});
admin.post('/payments/:id/:decision', async (req, res) => {
  const id = param(req, 'id');
  const decision = param(req, 'decision');
  if (!isUuid(id) || !['approve', 'reject'].includes(decision)) throw notFound();
  const { note } = parse(z.object({ note: z.string().max(300).default('') }), req.body);
  const approved = decision === 'approve';
  const out = await tx(async (c) => {
    const p = (await c.query(`UPDATE payments SET status=$2, note=$3, reviewed_at=now() WHERE id=$1 AND status='pending' RETURNING *`, [id, approved ? 'approved' : 'rejected', note])).rows[0];
    if (!p) throw bad('This payment was already reviewed');
    let until: Date | null = null;
    if (approved && p.user_id) {
      until = (
        await c.query(
          `UPDATE users SET premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(months => $2) WHERE id=$1 RETURNING premium_until`,
          [p.user_id, p.months],
        )
      ).rows[0]?.premium_until;
    }
    return { p, until };
  });
  if (out.p.user_id) emails.payment(out.p.user_id, approved, out.p.plan, out.until, note);
  await audit(req, `payment_${decision}`, out.p.user_id, { amount: Number(out.p.amount), currency: out.p.currency, reference: out.p.reference });
  res.json({ ok: true });
});

/* ---------------- settings ---------------- */
import { PROVIDERS } from '../settings.js';
admin.get('/settings', async (_req, res) => {
  const [plans, paymentMethods, ads, limits, ai] = await Promise.all([getSetting('plans'), getSetting('paymentMethods'), getSetting('ads'), getSetting('limits'), getSetting('ai')]);
  const keys: Record<string, { source: 'admin' | 'env' | 'none'; preview: string }> = {};
  for (const p of PROVIDERS) {
    const override = Boolean(ai.keys?.[p]);
    const eff = await aiKey(p);
    keys[p] = { source: override ? 'admin' : eff ? 'env' : 'none', preview: mask(eff) };
  }
  res.json({ plans, paymentMethods, ads, limits, ai: { enabled: ai.enabled, order: ai.order, models: ai.models, customBaseUrl: ai.customBaseUrl, keys } });
});

const planSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().min(2).max(60), months: z.number().int().min(1).max(36), pricePKR: z.number().min(0), priceUSD: z.number().min(0), highlight: z.boolean().optional() })).min(1).max(6);
const methodSchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().min(2).max(40), enabled: z.boolean(), currency: z.enum(['PKR', 'USD']),
  details: z.array(z.object({ label: z.string().max(40), value: z.string().max(120) })).max(8), link: z.string().max(300).optional(), instructions: z.string().max(400),
})).max(10);
const adsSchema = z.object({ enabled: z.boolean(), adsenseClient: z.string().max(60), slotDiscover: z.string().max(40), slotChats: z.string().max(40), admobAppId: z.string().max(80) });
const limitsSchema = z.object({ freeDailyChallenges: z.number().int().min(1).max(500), premiumDailyChallenges: z.number().int().min(1).max(5000), freeRetakeHours: z.number().int().min(0).max(720), premiumRetakeHours: z.number().int().min(0).max(720) });
const aiSchema = z.object({
  enabled: z.boolean(),
  order: z.array(z.enum(PROVIDERS as [Provider, ...Provider[]])).max(5),
  models: z.record(z.string(), z.string().max(100)),
  customBaseUrl: z.string().max(300).default(''),
  keys: z.record(z.string(), z.string().max(400)).optional(), // '' = keep, '__clear__' = remove, otherwise new key
});

admin.put('/settings/:section', async (req, res) => {
  const section = param(req, 'section');
  switch (section) {
    case 'plans': await setSetting('plans', parse(planSchema, req.body)); break;
    case 'paymentMethods': await setSetting('paymentMethods', parse(methodSchema, req.body)); break;
    case 'ads': await setSetting('ads', parse(adsSchema, req.body)); break;
    case 'limits': await setSetting('limits', parse(limitsSchema, req.body)); break;
    case 'ai': {
      const s = parse(aiSchema, req.body);
      const cur = await getSetting('ai');
      const keys = { ...(cur.keys || {}) } as Record<string, string>;
      for (const [p, v] of Object.entries(s.keys || {})) {
        if (!PROVIDERS.includes(p as Provider)) continue;
        if (v === '__clear__') delete keys[p];
        else if (v.trim()) keys[p] = encrypt(v.trim());
      }
      await setSetting('ai', { enabled: s.enabled, order: s.order, models: { ...DEFAULTS.ai.models, ...s.models }, customBaseUrl: s.customBaseUrl, keys });
      break;
    }
    default: throw notFound();
  }
  await audit(req, 'settings_update', section);
  res.json({ ok: true });
});

admin.post('/ai/check', async (req, res) => {
  const results = await checkProviders();
  await audit(req, 'ai_check', undefined, { ok: results.filter((r) => r.state === 'ok').length, total: results.length });
  res.json({ results });
});

/** Runs the AI generator against a real profile (or a sample) so the admin can confirm keys work. */
admin.post('/ai/test', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().max(128).optional() }), req.body);
  let facts: Record<string, unknown>;
  let age: number | null = 29;
  const u = userId ? (await q<UserRow>('SELECT * FROM users WHERE id=$1', [userId])).rows[0] : (await q<UserRow>('SELECT * FROM users WHERE onboarded ORDER BY random() LIMIT 1')).rows[0];
  if (u) {
    facts = quizFacts(u);
    age = ageFrom(u.dob);
  } else {
    facts = { firstName: 'Hira', age: 29, city: 'Islamabad', country: 'Pakistan', jobTitle: 'Teacher', company: 'Beaconhouse', interests: ['Reading', 'Poetry', 'Coffee', 'Hiking', 'Chess'], ownWords: [{ prompt: 'My perfect weekend', answer: 'Library till Asr, then poetry at home' }] };
  }
  const started = Date.now();
  const r = await generateAIQuiz(facts, 5, age);
  res.json({ provider: r.provider, errors: r.errors, ms: Date.now() - started, questions: r.questions.map((x) => ({ q: x.q, options: x.options, answer: x.options[x.answer] })), profile: u ? u.name : 'Sample profile' });
});

admin.get('/audit', async (_req, res) => {
  const r = await q('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200');
  res.json({ audit: r.rows });
});
