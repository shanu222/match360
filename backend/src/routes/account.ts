import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { bad, conflict, parse, HttpError, notFound } from '../http.js';
import {
  CHILDREN, DRINKING, EDUCATION_LEVELS, GENDERS, INDUSTRIES, INTENTS, INTERESTED_IN, INTERESTS, MARITAL, PROMPT_QUESTIONS, RELIGIONS, SMOKING,
} from '../catalog.js';
import { ageFrom, isComplete, isPremium, missingFields, privateProfile, publicProfile, type UserRow } from '../profiles.js';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, deletePhotos, deletePrivate, isOwnPhotoUrl, isOwnPrivateKey, signPhotoUpload, signPrivateUpload } from '../storage.js';
import { r2Enabled } from '../config.js';
import { clearStatusCache, deleteFirebaseUser, forgetUser } from '../auth.js';
import { citiesOf, countries, countryName, isCityOf, isCountry, nearestCity } from '../geo.js';
import { getSetting } from '../settings.js';
import { emails } from '../email.js';
import { isBlocked, isUuid, loadUser, me, param, visibleUser } from './common.js';

export const account = Router();

const META = {
  intents: INTENTS, genders: GENDERS, interestedIn: INTERESTED_IN, interests: INTERESTS, prompts: PROMPT_QUESTIONS,
  educationLevels: EDUCATION_LEVELS, industries: INDUSTRIES, marital: MARITAL, children: CHILDREN, smoking: SMOKING, drinking: DRINKING, religions: RELIGIONS,
};
export const metaHandler = (_req: any, res: any) => res.json({ ...META, uploadsEnabled: r2Enabled(), maxPhotos: 6 });
account.get('/meta', metaHandler);

/* ---------- geography ---------- */
export const countriesHandler = (_req: any, res: any) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ countries });
};
account.get('/geo/countries', countriesHandler);
export const citiesHandler = (req: any, res: any) => {
  const code = String(req.query.country || '').toUpperCase();
  const term = String(req.query.q || '').trim().toLowerCase();
  const all = citiesOf(code);
  let list = all;
  if (term) {
    const starts = all.filter((c) => c.name.toLowerCase().startsWith(term));
    const contains = all.filter((c) => !c.name.toLowerCase().startsWith(term) && c.name.toLowerCase().includes(term));
    list = [...starts, ...contains];
  }
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ cities: list.slice(0, term ? 60 : 400).map((c) => c.name), total: all.length });
};
account.get('/geo/cities', citiesHandler);

account.post('/me/location', async (req, res) => {
  const { lat, lng } = parse(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }), req.body);
  const near = nearestCity(lat, lng);
  // Stored at ~1 km precision; exact coordinates are never kept or shown.
  const rl = Math.round(lat * 100) / 100;
  const rn = Math.round(lng * 100) / 100;
  await q('UPDATE users SET lat=$2, lng=$3, location_updated_at=now() WHERE id=$1', [req.user.uid, rl, rn]);
  res.json({ country: near?.country || '', countryName: near ? countryName(near.country) : '', city: near?.city || '' });
});
account.delete('/me/location', async (req, res) => {
  await q('UPDATE users SET lat=NULL, lng=NULL, location_updated_at=NULL WHERE id=$1', [req.user.uid]);
  res.json({ ok: true });
});

/* ---------- public config for the app (plans, payments, ads) ---------- */
account.get('/config', async (req, res) => {
  const u = await loadUser(req.user.uid);
  const [plans, methods, ads, limits] = await Promise.all([getSetting('plans'), getSetting('paymentMethods'), getSetting('ads'), getSetting('limits')]);
  res.json({
    plans,
    paymentMethods: methods.filter((m) => m.enabled),
    ads: { enabled: ads.enabled, adsenseClient: ads.adsenseClient, slotDiscover: ads.slotDiscover, slotChats: ads.slotChats },
    limits,
    premium: u ? isPremium(u) : false,
    premiumUntil: u?.premium_until || null,
  });
});

/* ---------- me ---------- */
async function summary(uid: string) {
  const r = await q(
    `SELECT
      (SELECT count(*) FROM quiz_attempts WHERE taker_id=$1 AND submitted_at IS NOT NULL)::int AS taken,
      (SELECT coalesce(round(avg(score)),0) FROM quiz_attempts WHERE taker_id=$1 AND submitted_at IS NOT NULL)::int AS avg,
      (SELECT count(*) FROM quiz_attempts WHERE taker_id=$1 AND score=100)::int AS perfect,
      (SELECT count(*) FROM requests WHERE (sender_id=$1 OR receiver_id=$1) AND status='accepted')::int AS connections,
      (SELECT count(*) FROM requests WHERE receiver_id=$1)::int AS received,
      (SELECT count(*) FROM requests WHERE receiver_id=$1 AND status='pending')::int AS pending,
      (SELECT count(*) FROM notifications WHERE user_id=$1 AND NOT read)::int AS unread_notifications,
      (SELECT count(*) FROM messages m JOIN requests r ON r.id=m.match_id
         WHERE r.status='accepted' AND (r.sender_id=$1 OR r.receiver_id=$1) AND m.sender_id<>$1 AND m.read_at IS NULL)::int AS unread_messages,
      (SELECT count(*) FROM messages WHERE sender_id=$1)::int AS sent_messages,
      (SELECT status FROM verifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1) AS verification`,
    [uid],
  );
  const s = r.rows[0];
  return {
    stats: { challengesTaken: s.taken, avgScore: s.avg, perfectScores: s.perfect, connections: s.connections, requestsReceived: s.received, messagesSent: s.sent_messages },
    counts: { pendingRequests: s.pending, unreadNotifications: s.unread_notifications, unreadMessages: s.unread_messages },
    verification: s.verification || 'none',
  };
}

account.get('/me', async (req, res) => {
  const u = await me(req, { requireProfile: false });
  res.json({ user: privateProfile(u), missing: missingFields(u), ...(await summary(u.id)) });
});
account.get('/me/counts', async (req, res) => {
  res.json((await summary(req.user.uid)).counts);
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const opt = (list: string[]) => z.union([z.enum(list as [string, ...string[]]), z.literal('')]).default('');
const text = (min: number, max: number) => z.string().trim().min(min, min ? `at least ${min} characters` : undefined).max(max);
const profileSchema = z.object({
  name: text(2, 60),
  dob: dateStr,
  gender: z.enum(GENDERS as [string, ...string[]]),
  interestedIn: z.enum(INTERESTED_IN as [string, ...string[]]).default('Everyone'),
  country: z.string().length(2),
  city: text(1, 80),
  hometown: z.string().trim().max(80).default(''),
  job: text(2, 60),
  company: text(2, 80),
  industry: z.enum(INDUSTRIES as [string, ...string[]]),
  educationLevel: z.enum(EDUCATION_LEVELS as [string, ...string[]]),
  education: text(2, 100),
  languages: text(2, 120),
  intent: z.enum(INTENTS as [string, ...string[]]),
  interests: z.array(z.enum(INTERESTS as [string, ...string[]])).min(5, 'pick at least 5').max(12, 'pick at most 12'),
  bio: text(80, 600),
  prompts: z.array(z.object({ q: z.enum(PROMPT_QUESTIONS as [string, ...string[]]), a: text(3, 120) })).length(3, 'answer all 3 prompts'),
  heightCm: z.number().int().min(120).max(230).nullable().default(null),
  maritalStatus: opt(MARITAL),
  children: opt(CHILDREN),
  religion: opt(RELIGIONS),
  smoking: opt(SMOKING),
  drinking: opt(DRINKING),
  photos: z.array(z.object({ url: z.string().url(), blurUrl: z.string().url() })).max(6).default([]),
  photoBlur: z.boolean().default(false),
  threshold: z.number().int().min(0).max(100).default(60),
});

account.put('/me', async (req, res) => {
  const cur = await me(req, { requireProfile: false });
  const p = parse(profileSchema, req.body);
  const age = ageFrom(p.dob);
  if (age === null || age < 18) throw bad('You must be 18 or older to use Match360', 'underage');
  if (age > 100) throw bad('Please enter a valid date of birth', 'validation');
  if (!isCountry(p.country)) throw bad('Please choose a valid country', 'validation');
  if (!isCityOf(p.country, p.city)) throw bad('Please choose a city from the list', 'validation');
  if (new Set(p.prompts.map((x) => x.q)).size !== 3) throw bad('Choose a different question for each prompt', 'validation');
  const interests = [...new Set(p.interests)];
  for (const ph of p.photos) {
    const known = cur.photos.includes(ph.url);
    if (!known && (!isOwnPhotoUrl(cur.id, ph.url) || !isOwnPhotoUrl(cur.id, ph.blurUrl))) throw bad('Invalid photo', 'validation');
  }
  const photos = p.photos.map((x) => x.url);
  const blurred = p.photos.map((x) => x.blurUrl);

  const r = await q<UserRow>(
    `UPDATE users SET name=$2, dob=$3, gender=$4, interested_in=$5, country=$6, city=$7, hometown=$8, job=$9, company=$10, industry=$11,
       education_level=$12, education=$13, languages=$14, intent=$15, interests=$16, bio=$17, prompts=$18, height_cm=$19, marital_status=$20,
       children=$21, religion=$22, smoking=$23, drinking=$24, photos=$25, photos_blurred=$26, photo_blur=$27, threshold=$28, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [cur.id, p.name, p.dob, p.gender, p.interestedIn, p.country, p.city, p.hometown, p.job, p.company, p.industry, p.educationLevel, p.education,
      p.languages, p.intent, interests, p.bio, JSON.stringify(p.prompts), p.heightCm, p.maritalStatus, p.children, p.religion, p.smoking, p.drinking,
      photos, blurred, p.photoBlur, p.threshold],
  );
  let u = r.rows[0];
  const onboarded = isComplete(u);
  if (onboarded !== u.onboarded || (onboarded && !u.welcomed)) {
    u = (await q<UserRow>('UPDATE users SET onboarded=$2, welcomed=welcomed OR $2 WHERE id=$1 RETURNING *', [cur.id, onboarded])).rows[0];
    if (onboarded && !cur.welcomed) emails.welcome(cur.id, p.name.split(' ')[0]);
  }
  const removed = [...cur.photos.filter((x) => !photos.includes(x)), ...cur.photos_blurred.filter((x) => !blurred.includes(x))];
  if (removed.length) void deletePhotos(removed);
  res.json({ user: privateProfile(u), missing: missingFields(u) });
});

const settingsSchema = z.object({
  incognito: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  threshold: z.number().int().min(0).max(100).optional(),
  photoBlur: z.boolean().optional(),
  interestedIn: z.enum(INTERESTED_IN as [string, ...string[]]).optional(),
});
account.patch('/me/settings', async (req, res) => {
  const s = parse(settingsSchema, req.body);
  const r = await q<UserRow>(
    `UPDATE users SET incognito=coalesce($2,incognito), email_notifications=coalesce($3,email_notifications),
       threshold=coalesce($4,threshold), photo_blur=coalesce($5,photo_blur), interested_in=coalesce($6,interested_in), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [req.user.uid, s.incognito ?? null, s.emailNotifications ?? null, s.threshold ?? null, s.photoBlur ?? null, s.interestedIn ?? null],
  );
  res.json({ user: privateProfile(r.rows[0]) });
});

account.delete('/me', async (req, res) => {
  const u = await loadUser(req.user.uid);
  if (u) {
    const priv = await q(
      `SELECT doc_key AS k FROM verifications WHERE user_id=$1 UNION ALL SELECT selfie_key FROM verifications WHERE user_id=$1
       UNION ALL SELECT proof_key FROM payments WHERE user_id=$1`,
      [u.id],
    );
    await q('DELETE FROM users WHERE id=$1', [u.id]);
    void deletePhotos([...u.photos, ...u.photos_blurred]);
    void deletePrivate(priv.rows.map((x) => x.k));
  }
  forgetUser(req.user.uid);
  clearStatusCache(req.user.uid);
  await deleteFirebaseUser(req.user.uid);
  res.json({ ok: true });
});

/* ---------- uploads ---------- */
const signSchema = z.object({ kind: z.enum(['photo', 'id_doc', 'selfie', 'proof']).default('photo'), contentType: z.string(), size: z.number().int().positive() });
account.post('/uploads/sign', async (req, res) => {
  if (!r2Enabled()) throw new HttpError(503, 'Uploads are not configured yet', 'uploads_disabled');
  const s = parse(signSchema, req.body);
  if (!ALLOWED_TYPES[s.contentType]) throw bad('Only JPEG, PNG or WebP images are allowed', 'validation');
  if (s.size > MAX_UPLOAD_BYTES) throw bad('Image must be under 5 MB', 'validation');
  if (s.kind === 'photo') return res.json(await signPhotoUpload(req.user.uid, s.contentType, s.size));
  res.json(await signPrivateUpload(req.user.uid, s.kind, s.contentType, s.size));
});

/* ---------- discover ---------- */
account.get('/discover', async (req, res) => {
  const viewer = await me(req);
  const str = (k: string, max = 80) => (typeof req.query[k] === 'string' && (req.query[k] as string).length <= max ? (req.query[k] as string) : null);
  const intent = INTENTS.includes(str('intent') || '') ? str('intent') : null;
  const country = str('country', 2)?.toUpperCase() || null;
  const city = str('city');
  const verified = req.query.verified === '1';
  const km = Number(req.query.km) || null;
  const nearOk = km && viewer.lat != null && viewer.lng != null;
  const genderPref = viewer.interested_in === 'Women' ? 'Woman' : viewer.interested_in === 'Men' ? 'Man' : null;
  const r = await q<UserRow>(
    `SELECT u.* FROM users u
     WHERE u.id <> $1 AND u.onboarded AND NOT u.incognito AND u.status='active'
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
       AND NOT EXISTS (SELECT 1 FROM requests r WHERE (r.sender_id=$1 AND r.receiver_id=u.id) OR (r.sender_id=u.id AND r.receiver_id=$1))
       AND NOT EXISTS (SELECT 1 FROM passes p WHERE p.user_id=$1 AND p.target_id=u.id)
       AND ($2::text IS NULL OR u.intent=$2)
       AND ($3::text IS NULL OR u.country=$3)
       AND ($4::text IS NULL OR lower(u.city)=lower($4))
       AND ($5::boolean = false OR u.id_verified)
       AND ($6::text IS NULL OR u.gender=$6)
       AND ($7::float8 IS NULL OR (u.lat IS NOT NULL AND
            6371 * 2 * asin(sqrt(power(sin(radians(u.lat-$8)/2),2) + cos(radians($8))*cos(radians(u.lat))*power(sin(radians(u.lng-$9)/2),2))) <= $7))
     ORDER BY (u.premium_until > now()) DESC NULLS LAST,
              cardinality(ARRAY(SELECT unnest(u.interests) INTERSECT SELECT unnest($10::text[]))) DESC,
              (u.intent = $11) DESC, u.last_seen DESC
     LIMIT 40`,
    [viewer.id, intent, country, city, verified, genderPref, nearOk ? km : null, viewer.lat, viewer.lng, viewer.interests, viewer.intent],
  );
  res.json({ profiles: r.rows.map((u) => publicProfile(u, viewer)) });
});

account.post('/passes', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1).max(128) }), req.body);
  await q('INSERT INTO passes (user_id, target_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.uid, userId]).catch(() => {});
  res.json({ ok: true });
});
account.delete('/passes', async (req, res) => {
  await q('DELETE FROM passes WHERE user_id=$1', [req.user.uid]);
  res.json({ ok: true });
});

export async function relation(viewer: UserRow, otherId: string) {
  const viewerId = viewer.id;
  const r = await q(
    `SELECT id, sender_id, receiver_id, status, sender_score, receiver_score FROM requests
     WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)`,
    [viewerId, otherId],
  );
  const req = r.rows[0];
  if (req) {
    if (req.status === 'accepted') return { type: 'matched', matchId: req.id };
    if (req.sender_id === viewerId) return { type: 'sent', requestId: req.id, status: req.status, score: req.sender_score };
    return { type: 'received', requestId: req.id, status: req.status, score: req.sender_score };
  }
  const a = await q(
    `SELECT id, score, submitted_at, expires_at, started_at FROM quiz_attempts
     WHERE taker_id=$1 AND target_id=$2 AND purpose='request' ORDER BY started_at DESC LIMIT 1`,
    [viewerId, otherId],
  );
  const at = a.rows[0];
  if (at) {
    const now = Date.now();
    if (at.submitted_at && now - new Date(at.submitted_at).getTime() < 3600_000) return { type: 'ready_to_send', attemptId: at.id, score: at.score };
    if (!at.submitted_at && now < new Date(at.expires_at).getTime()) return { type: 'in_progress' };
    const limits = await getSetting('limits');
    const hours = isPremium(viewer) ? limits.premiumRetakeHours : limits.freeRetakeHours;
    const retryAt = new Date(new Date(at.started_at).getTime() + hours * 3600_000);
    if (retryAt.getTime() > now) return { type: 'cooldown', retryAt };
  }
  return { type: 'none' };
}

account.get('/users/:id', async (req, res) => {
  const viewer = await me(req);
  const u = await visibleUser(viewer.id, param(req, 'id'));
  const rel = await relation(viewer, u.id);
  res.json({ profile: publicProfile(u, viewer, { connected: rel.type === 'matched' }), relation: rel });
});

/* ---------- safety ---------- */
account.get('/blocks', async (req, res) => {
  const r = await q(`SELECT u.id, u.name, u.photos, u.photos_blurred, u.photo_blur FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC`, [req.user.uid]);
  res.json({ blocked: r.rows.map((x) => ({ id: x.id, name: x.name, photo: (x.photo_blur ? x.photos_blurred[0] : x.photos[0]) || null })) });
});
async function closeBetween(a: string, b: string) {
  await q(
    `UPDATE requests SET status='closed', responded_at=coalesce(responded_at, now())
     WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) AND status IN ('pending','accepted')`,
    [a, b],
  );
}
account.post('/blocks', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1).max(128) }), req.body);
  if (userId === req.user.uid) throw bad('You cannot block yourself');
  if (!(await loadUser(userId))) throw notFound('User not found');
  await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.uid, userId]);
  await closeBetween(req.user.uid, userId);
  res.json({ ok: true });
});
account.delete('/blocks/:id', async (req, res) => {
  await q('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.user.uid, param(req, 'id')]);
  res.json({ ok: true });
});

export const REPORT_REASONS = ['Fake profile or scam', 'Inappropriate messages', 'Harassment', 'Underage user', 'Inappropriate photos', 'Asking for money', 'Something else'] as const;
const reportSchema = z.object({
  userId: z.string().min(1).max(128),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).default(''),
  block: z.boolean().default(true),
});
account.post('/reports', async (req, res) => {
  const s = parse(reportSchema, req.body);
  if (s.userId === req.user.uid) throw bad('You cannot report yourself');
  await q('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1,$2,$3,$4)', [req.user.uid, s.userId, s.reason, s.details]);
  if (s.block && !(await isBlocked(req.user.uid, s.userId))) {
    await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.uid, s.userId]);
    await closeBetween(req.user.uid, s.userId);
  }
  res.json({ ok: true });
});

/* ---------- notifications ---------- */
account.get('/notifications', async (req, res) => {
  const r = await q(
    `SELECT n.id, n.type, n.body, n.ref_id, n.read, n.created_at, n.actor_id, u.name AS actor_name,
       CASE WHEN u.photo_blur THEN u.photos_blurred[1] ELSE u.photos[1] END AS actor_photo
     FROM notifications n LEFT JOIN users u ON u.id=n.actor_id
     WHERE n.user_id=$1 ORDER BY n.id DESC LIMIT 50`,
    [req.user.uid],
  );
  res.json({ notifications: r.rows });
});
account.post('/notifications/read', async (req, res) => {
  await q('UPDATE notifications SET read=true WHERE user_id=$1 AND NOT read', [req.user.uid]);
  res.json({ ok: true });
});

/* ---------- identity verification ---------- */
account.get('/verification', async (req, res) => {
  const r = await q('SELECT id, doc_type, status, note, created_at, reviewed_at FROM verifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.user.uid]);
  res.json({ verification: r.rows[0] || null });
});
export const DOC_TYPES = ['CNIC / National ID', 'Passport', 'Driving licence', 'Student ID', 'Employee ID'] as const;
const verifySchema = z.object({ docType: z.enum(DOC_TYPES), docKey: z.string().max(300), selfieKey: z.string().max(300) });
account.post('/verification', async (req, res) => {
  const u = await me(req);
  const s = parse(verifySchema, req.body);
  if (!isOwnPrivateKey(u.id, 'id_doc', s.docKey) || !isOwnPrivateKey(u.id, 'selfie', s.selfieKey)) throw bad('Please upload both images again', 'validation');
  if (u.id_verified) throw conflict('Your profile is already verified', 'already_verified');
  const pending = await q(`SELECT 1 FROM verifications WHERE user_id=$1 AND status='pending'`, [u.id]);
  if (pending.rowCount) throw conflict('Your documents are already being reviewed', 'pending');
  await q('INSERT INTO verifications (user_id, doc_type, doc_key, selfie_key) VALUES ($1,$2,$3,$4)', [u.id, s.docType, s.docKey, s.selfieKey]);
  res.json({ ok: true });
});

/* ---------- premium payments ---------- */
account.get('/payments', async (req, res) => {
  const r = await q('SELECT id, plan, months, amount, currency, method, reference, status, note, created_at, reviewed_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.uid]);
  res.json({ payments: r.rows });
});
const paySchema = z.object({
  planId: z.string().max(40),
  methodId: z.string().max(40),
  reference: z.string().trim().min(4, 'enter the transaction ID').max(80),
  sender: z.string().trim().max(80).default(''),
  proofKey: z.string().max(300).optional(),
});
account.post('/payments', async (req, res) => {
  const u = await me(req);
  const s = parse(paySchema, req.body);
  const [plans, methods] = await Promise.all([getSetting('plans'), getSetting('paymentMethods')]);
  const plan = plans.find((p) => p.id === s.planId);
  const method = methods.find((m) => m.id === s.methodId && m.enabled);
  if (!plan || !method) throw bad('Please choose a plan and payment method', 'validation');
  if (s.proofKey && !isOwnPrivateKey(u.id, 'proof', s.proofKey)) throw bad('Please upload the screenshot again', 'validation');
  const pending = await q(`SELECT count(*)::int AS n FROM payments WHERE user_id=$1 AND status='pending'`, [u.id]);
  if (pending.rows[0].n >= 3) throw conflict('You already have payments waiting for review', 'too_many_pending');
  const amount = method.currency === 'USD' ? plan.priceUSD : plan.pricePKR;
  try {
    await q(
      `INSERT INTO payments (user_id, plan, months, amount, currency, method, reference, sender, proof_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [u.id, plan.name, plan.months, amount, method.currency, method.name, s.reference, s.sender, s.proofKey || null],
    );
  } catch (e: any) {
    if (e?.code === '23505') throw conflict('This transaction ID has already been submitted', 'duplicate_reference');
    throw e;
  }
  res.json({ ok: true });
});

export { isUuid };
