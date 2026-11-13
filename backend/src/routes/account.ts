import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { bad, parse, HttpError, notFound } from '../http.js';
import { CITIES, INTENTS, INTERESTS, PROMPT_QUESTIONS } from '../catalog.js';
import { ageFrom, isComplete, privateProfile, publicProfile, type UserRow } from '../profiles.js';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, deletePhotos, isOwnPhotoUrl, signPhotoUpload } from '../storage.js';
import { r2Enabled } from '../config.js';
import { deleteFirebaseUser, forgetUser } from '../auth.js';
import { isBlocked, isUuid, loadUser, me, param, visibleUser } from './common.js';

export const account = Router();

export const metaHandler = (_req: any, res: any) => {
  res.json({
    intents: INTENTS,
    interests: INTERESTS,
    cities: CITIES,
    prompts: PROMPT_QUESTIONS,
    uploadsEnabled: r2Enabled(),
    maxPhotos: 6,
  });
};
account.get('/meta', metaHandler);

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
      (SELECT count(*) FROM messages WHERE sender_id=$1)::int AS sent_messages`,
    [uid],
  );
  const s = r.rows[0];
  return {
    stats: { challengesTaken: s.taken, avgScore: s.avg, perfectScores: s.perfect, connections: s.connections, requestsReceived: s.received, messagesSent: s.sent_messages },
    counts: { pendingRequests: s.pending, unreadNotifications: s.unread_notifications, unreadMessages: s.unread_messages },
  };
}

account.get('/me', async (req, res) => {
  const u = await me(req, { requireProfile: false });
  res.json({ user: privateProfile(u), ...(await summary(u.id)) });
});

account.get('/me/counts', async (req, res) => {
  res.json((await summary(req.user.uid)).counts);
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const profileSchema = z.object({
  name: z.string().trim().min(2, 'too short').max(60),
  dob: dateStr,
  city: z.string().trim().min(2).max(60),
  job: z.string().trim().min(2).max(60),
  education: z.string().trim().max(80).default(''),
  languages: z.string().trim().max(100).default(''),
  intent: z.enum(INTENTS as [string, ...string[]]),
  interests: z.array(z.enum(INTERESTS as [string, ...string[]])).min(3, 'pick at least 3').max(10, 'pick at most 10'),
  bio: z.string().trim().max(300).default(''),
  prompts: z
    .array(z.object({ q: z.enum(PROMPT_QUESTIONS as [string, ...string[]]), a: z.string().trim().max(100) }))
    .max(3)
    .default([]),
  photos: z.array(z.string().url()).max(6).default([]),
  threshold: z.number().int().min(0).max(100).default(60),
});

account.put('/me', async (req, res) => {
  const cur = await me(req, { requireProfile: false });
  const p = parse(profileSchema, req.body);
  const age = ageFrom(p.dob);
  if (age === null || age < 18) throw bad('You must be 18 or older to use Match360', 'underage');
  if (age > 100) throw bad('Please enter a valid date of birth', 'validation');
  const interests = [...new Set(p.interests)];
  const prompts = p.prompts.filter((x, i, a) => a.findIndex((y) => y.q === x.q) === i);
  if (prompts.filter((x) => x.a).length < 2) throw bad('Answer at least 2 prompts — they power your challenge', 'validation');
  const photos = [...new Set(p.photos)];
  for (const url of photos) if (!cur.photos.includes(url) && !isOwnPhotoUrl(cur.id, url)) throw bad('Invalid photo', 'validation');

  const next = { ...cur, ...p, interests, prompts, photos } as UserRow;
  const onboarded = isComplete(next);
  const r = await q<UserRow>(
    `UPDATE users SET name=$2, dob=$3, city=$4, job=$5, education=$6, languages=$7, intent=$8, interests=$9, bio=$10,
       prompts=$11, photos=$12, threshold=$13, onboarded=$14, updated_at=now() WHERE id=$1 RETURNING *`,
    [cur.id, p.name, p.dob, p.city, p.job, p.education, p.languages, p.intent, interests, p.bio, JSON.stringify(prompts), photos, p.threshold, onboarded],
  );
  const removed = cur.photos.filter((x) => !photos.includes(x));
  if (removed.length) void deletePhotos(removed);
  res.json({ user: privateProfile(r.rows[0]) });
});

const settingsSchema = z.object({
  incognito: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  threshold: z.number().int().min(0).max(100).optional(),
});
account.patch('/me/settings', async (req, res) => {
  const s = parse(settingsSchema, req.body);
  const r = await q<UserRow>(
    `UPDATE users SET incognito=coalesce($2,incognito), email_notifications=coalesce($3,email_notifications),
       threshold=coalesce($4,threshold), updated_at=now() WHERE id=$1 RETURNING *`,
    [req.user.uid, s.incognito ?? null, s.emailNotifications ?? null, s.threshold ?? null],
  );
  res.json({ user: privateProfile(r.rows[0]) });
});

account.delete('/me', async (req, res) => {
  const u = await loadUser(req.user.uid);
  if (u) {
    await q('DELETE FROM users WHERE id=$1', [u.id]);
    void deletePhotos(u.photos);
  }
  forgetUser(req.user.uid);
  await deleteFirebaseUser(req.user.uid);
  res.json({ ok: true });
});

const signSchema = z.object({ contentType: z.string(), size: z.number().int().positive() });
account.post('/uploads/sign', async (req, res) => {
  if (!r2Enabled()) throw new HttpError(503, 'Photo uploads are not configured yet', 'uploads_disabled');
  const s = parse(signSchema, req.body);
  if (!ALLOWED_TYPES[s.contentType]) throw bad('Only JPEG, PNG or WebP images are allowed', 'validation');
  if (s.size > MAX_UPLOAD_BYTES) throw bad('Image must be under 5 MB', 'validation');
  res.json(await signPhotoUpload(req.user.uid, s.contentType, s.size));
});

account.get('/discover', async (req, res) => {
  const viewer = await me(req);
  const intent = typeof req.query.intent === 'string' && INTENTS.includes(req.query.intent) ? req.query.intent : null;
  const city = typeof req.query.city === 'string' && req.query.city.length <= 60 ? req.query.city : null;
  const verified = req.query.verified === '1';
  const r = await q<UserRow>(
    `SELECT u.* FROM users u
     WHERE u.id <> $1 AND u.onboarded AND NOT u.incognito
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
       AND NOT EXISTS (SELECT 1 FROM requests r WHERE (r.sender_id=$1 AND r.receiver_id=u.id) OR (r.sender_id=u.id AND r.receiver_id=$1))
       AND NOT EXISTS (SELECT 1 FROM passes p WHERE p.user_id=$1 AND p.target_id=u.id)
       AND ($2::text IS NULL OR u.intent=$2)
       AND ($3::text IS NULL OR u.city=$3)
       AND ($4::boolean = false OR u.email_verified)
     ORDER BY cardinality(ARRAY(SELECT unnest(u.interests) INTERSECT SELECT unnest($5::text[]))) DESC,
              (u.intent = $6) DESC, u.last_seen DESC
     LIMIT 40`,
    [viewer.id, intent, city, verified, viewer.interests, viewer.intent],
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

async function relation(viewerId: string, otherId: string) {
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
    if (at.submitted_at && now - new Date(at.submitted_at).getTime() < 3600_000)
      return { type: 'ready_to_send', attemptId: at.id, score: at.score };
    if (!at.submitted_at && now < new Date(at.expires_at).getTime()) return { type: 'in_progress' };
    const retryAt = new Date(new Date(at.started_at).getTime() + 24 * 3600_000);
    if (retryAt.getTime() > now) return { type: 'cooldown', retryAt };
  }
  return { type: 'none' };
}
export { relation };

account.get('/users/:id', async (req, res) => {
  const viewer = await me(req);
  const u = await visibleUser(viewer.id, param(req, 'id'));
  res.json({ profile: publicProfile(u, viewer), relation: await relation(viewer.id, u.id) });
});

account.get('/blocks', async (req, res) => {
  const r = await q(
    `SELECT u.id, u.name, u.photos FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC`,
    [req.user.uid],
  );
  res.json({ blocked: r.rows.map((x) => ({ id: x.id, name: x.name, photo: x.photos[0] || null })) });
});
account.post('/blocks', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1).max(128) }), req.body);
  if (userId === req.user.uid) throw bad('You cannot block yourself');
  if (!(await loadUser(userId))) throw notFound('User not found');
  await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.uid, userId]);
  await q(
    `UPDATE requests SET status='closed', responded_at=coalesce(responded_at, now())
     WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) AND status IN ('pending','accepted')`,
    [req.user.uid, userId],
  );
  res.json({ ok: true });
});
account.delete('/blocks/:id', async (req, res) => {
  await q('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.user.uid, param(req, 'id')]);
  res.json({ ok: true });
});

const reportSchema = z.object({
  userId: z.string().min(1).max(128),
  reason: z.enum(['Fake profile or scam', 'Inappropriate messages', 'Harassment', 'Underage user', 'Inappropriate photos', 'Something else']),
  details: z.string().trim().max(1000).default(''),
  block: z.boolean().default(true),
});
account.post('/reports', async (req, res) => {
  const s = parse(reportSchema, req.body);
  if (s.userId === req.user.uid) throw bad('You cannot report yourself');
  await q('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1,$2,$3,$4)', [req.user.uid, s.userId, s.reason, s.details]);
  if (s.block && !(await isBlocked(req.user.uid, s.userId))) {
    await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.uid, s.userId]);
    await q(
      `UPDATE requests SET status='closed' WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)) AND status IN ('pending','accepted')`,
      [req.user.uid, s.userId],
    );
  }
  res.json({ ok: true });
});

account.get('/notifications', async (req, res) => {
  const r = await q(
    `SELECT n.id, n.type, n.body, n.ref_id, n.read, n.created_at, n.actor_id, u.name AS actor_name, u.photos[1] AS actor_photo
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

export { isUuid };
