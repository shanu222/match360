import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { q, tx } from '../db.js';
import { bad, conflict, forbidden, notFound, parse } from '../http.js';
import { isPremium, publicProfile, type UserRow } from '../profiles.js';
import { buildQuiz, SECONDS_PER_QUESTION, type StoredQuestion } from '../quiz.js';
import { getSetting } from '../settings.js';
import { emit, isOnline, notify } from '../realtime.js';
import { emails } from '../email.js';
import { isBlocked, isUuid, loadUser, me, param, visibleUser } from './common.js';

export const social = Router();

const byUser = (req: any) => req.user?.uid || ipKeyGenerator(req.ip || '');
const quizLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, keyGenerator: byUser, standardHeaders: true, legacyHeaders: false, message: { error: 'You’re connecting very fast. Take a short break.' } });
const msgLimiter = rateLimit({ windowMs: 60_000, limit: 40, keyGenerator: byUser, standardHeaders: true, legacyHeaders: false, message: { error: 'You’re sending messages too fast.' } });

const HOUR = 3600_000;
// One in-flight question generation per (taker, target, purpose) so double taps never create two attempts.
const inflight = new Map<string, Promise<any>>();
const SEND_WINDOW = 3600_000;

function clientQuiz(attempt: any, target: UserRow) {
  const qs: StoredQuestion[] = attempt.questions;
  return {
    attemptId: attempt.id,
    purpose: attempt.purpose,
    target: { id: target.id, firstName: target.name.split(' ')[0], photo: (target.photo_blur ? target.photos_blurred[0] : target.photos[0]) || null, threshold: target.threshold },
    questions: qs.map((x) => ({ q: x.q, options: x.options })),
    secondsPerQuestion: SECONDS_PER_QUESTION,
    expiresAt: attempt.expires_at,
    serverNow: new Date(),
  };
}

/* ---------------- QUIZ ---------------- */

const startSchema = z.object({ targetId: z.string().min(1).max(128), purpose: z.enum(['request', 'accept']) });

social.post('/quiz/start', quizLimiter, async (req, res) => {
  const viewer = await me(req);
  const { targetId, purpose } = parse(startSchema, req.body);
  const target = await visibleUser(viewer.id, targetId);

  const existing = await q(
    `SELECT id, sender_id, status FROM requests WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)`,
    [viewer.id, target.id],
  );
  const reqRow = existing.rows[0];

  if (purpose === 'request') {
    if (reqRow) {
      if (reqRow.sender_id === target.id && reqRow.status === 'pending')
        throw conflict(`${target.name.split(' ')[0]} already sent you a request — accept it instead`, 'they_requested_you', { requestId: reqRow.id });
      throw conflict('You already have a request with this person', 'already_requested');
    }
  } else {
    if (!reqRow || reqRow.sender_id !== target.id || reqRow.status !== 'pending') throw conflict('This request is no longer pending', 'not_pending');
  }

  const last = (
    await q(`SELECT * FROM quiz_attempts WHERE taker_id=$1 AND target_id=$2 AND purpose=$3 ORDER BY started_at DESC LIMIT 1`, [viewer.id, target.id, purpose])
  ).rows[0];
  const now = Date.now();
  if (last) {
    // Resume an unfinished attempt with the same questions (prevents re-rolling questions).
    if (!last.submitted_at && new Date(last.expires_at).getTime() > now) return res.json(clientQuiz(last, target));
    if (purpose === 'request') {
      if (last.submitted_at && now - new Date(last.submitted_at).getTime() < SEND_WINDOW)
        throw conflict('You already answered these questions', 'ready_to_send', { attemptId: last.id, score: last.score });
      const limits = await getSetting('limits');
      const hours = isPremium(viewer) ? limits.premiumRetakeHours : limits.freeRetakeHours;
      const retryAt = new Date(new Date(last.started_at).getTime() + hours * HOUR);
      if (retryAt.getTime() > now) throw conflict('You can try again later', 'cooldown', { retryAt });
    }
  }

  if (purpose === 'request') {
    const limits = await getSetting('limits');
    const premium = isPremium(viewer);
    const cap = premium ? limits.premiumDailyChallenges : limits.freeDailyChallenges;
    const used = (await q(`SELECT count(*)::int AS n FROM quiz_attempts WHERE taker_id=$1 AND purpose='request' AND started_at > now() - interval '24 hours'`, [viewer.id])).rows[0].n;
    if (used >= cap)
      throw conflict(
        premium ? `You’ve sent ${cap} connection requests in the last 24 hours. Try again later.` : `Free accounts can connect with ${cap} people a day. Upgrade to Premium for more, or try again tomorrow.`,
        'daily_limit',
        { premium },
      );
  }

  const lockKey = `${viewer.id}|${target.id}|${purpose}`;
  if (inflight.has(lockKey)) return res.json(await inflight.get(lockKey));
  const job = (async () => {

    const { questions, source } = await buildQuiz(target);
    if (questions.length < 3) throw bad('This profile doesn’t have enough details yet', 'profile_too_thin');
    const seconds = questions.length * SECONDS_PER_QUESTION + 30;
    const r = await q(
      `INSERT INTO quiz_attempts (taker_id, target_id, purpose, questions, expires_at, source)
       VALUES ($1,$2,$3,$4, now() + make_interval(secs => $5), $6) RETURNING *`,
      [viewer.id, target.id, purpose, JSON.stringify(questions), seconds, source],
    );
    return clientQuiz(r.rows[0], target);
  })();
  inflight.set(lockKey, job);
  try {
    res.json(await job);
  } finally {
    inflight.delete(lockKey);
  }
});

const submitSchema = z.object({ answers: z.array(z.number().int().min(-1).max(3)).max(20) });

social.post('/quiz/:id/submit', async (req, res) => {
  const id = param(req, 'id');
  if (!isUuid(id)) throw notFound('Not found');
  const { answers } = parse(submitSchema, req.body);
  const viewer = await me(req);

  const result = await tx(async (c) => {
    const at = (await c.query('SELECT * FROM quiz_attempts WHERE id=$1 AND taker_id=$2 FOR UPDATE', [id, viewer.id])).rows[0];
    if (!at) throw notFound('Not found');
    const qs: StoredQuestion[] = at.questions;
    if (at.submitted_at) return { at, qs, fresh: false };
    const late = Date.now() > new Date(at.expires_at).getTime() + 30_000;
    const given = qs.map((_, i) => (late ? -1 : (answers[i] ?? -1)));
    const correct = given.filter((a, i) => a === qs[i].answer).length;
    const score = Math.round((correct / qs.length) * 100);
    const upd = await c.query(
      'UPDATE quiz_attempts SET answers=$2, score=$3, correct=$4, submitted_at=now() WHERE id=$1 RETURNING *',
      [id, JSON.stringify(given), score, correct],
    );
    let matchId: string | null = null;
    if (at.purpose === 'accept') {
      const rr = await c.query(
        `UPDATE requests SET status='accepted', receiver_score=$3, responded_at=now(), last_message_at=now()
         WHERE sender_id=$1 AND receiver_id=$2 AND status='pending' RETURNING id, sender_score`,
        [at.target_id, viewer.id, score],
      );
      if (!rr.rows[0]) throw conflict('This request is no longer pending', 'not_pending');
      matchId = rr.rows[0].id;
    }
    return { at: upd.rows[0], qs, fresh: true, matchId };
  });

  const at = result.at;
  const target = await loadUser(at.target_id);
  const payload: any = {
    attemptId: at.id,
    purpose: at.purpose,
    score: at.score,
    correct: at.correct,
    total: result.qs.length,
    review: result.qs.map((x, i) => ({ q: x.q, options: x.options, correctIndex: x.answer, yourIndex: (at.answers || [])[i] ?? -1 })),
    meetsThreshold: target ? at.score >= target.threshold : false,
    threshold: target?.threshold ?? 0,
  };

  if (at.purpose === 'accept') {
    const m = (await q(`SELECT id FROM requests WHERE sender_id=$1 AND receiver_id=$2 AND status='accepted'`, [at.target_id, viewer.id])).rows[0];
    payload.matchId = m?.id || null;
    if (result.fresh && result.matchId && target) {
      const first = viewer.name.split(' ')[0];
      void notify(target.id, 'accepted', `${first} accepted your request and scored ${at.score}% on your profile`, viewer.id, result.matchId);
      emails.accepted(target.id, first, at.score, result.matchId);
      emit(target.id, 'match:new', { matchId: result.matchId });
      emit(viewer.id, 'match:new', { matchId: result.matchId });
    }
  }
  res.json(payload);
});

/* ---------------- REQUESTS ---------------- */

const sendSchema = z.object({ attemptId: z.string().uuid(), note: z.string().trim().max(250).default(''), likedPrompt: z.string().max(120).default('') });

social.post('/requests', async (req, res) => {
  const viewer = await me(req);
  const { attemptId, note, likedPrompt: liked } = parse(sendSchema, req.body);
  const at = (await q(`SELECT * FROM quiz_attempts WHERE id=$1 AND taker_id=$2 AND purpose='request'`, [attemptId, viewer.id])).rows[0];
  if (!at || !at.submitted_at) throw bad('Answer the questions before sending a request', 'quiz_incomplete');
  if (Date.now() - new Date(at.submitted_at).getTime() > SEND_WINDOW) throw conflict('This result has expired. You can try again later.', 'attempt_expired');
  const target = await visibleUser(viewer.id, at.target_id);

  let row;
  try {
    row = (
      await q(
        `INSERT INTO requests (sender_id, receiver_id, attempt_id, sender_score, note, liked_prompt)
         SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM requests WHERE sender_id=$2 AND receiver_id=$1)
         RETURNING *`,
        [viewer.id, target.id, at.id, at.score, note, (target.prompts || []).some((p) => p.q === liked) ? liked : ''],
      )
    ).rows[0];
  } catch (e: any) {
    if (e?.code === '23505') throw conflict('Request already sent', 'already_requested');
    throw e;
  }
  if (!row) throw conflict(`${target.name.split(' ')[0]} already sent you a request — accept it instead`, 'they_requested_you');

  const first = viewer.name.split(' ')[0];
  void notify(target.id, 'request', `${first} read your profile, got ${at.score}% right and wants to connect`, viewer.id, row.id);
  emails.newRequest(target.id, first, at.score);
  emit(target.id, 'request:new', { requestId: row.id });
  res.json({ request: { id: row.id, status: row.status, score: row.sender_score } });
});

social.get('/requests', async (req, res) => {
  const viewer = await me(req);
  const rows = (
    await q(
      `SELECT r.*, u.* , r.id AS request_id, r.created_at AS request_created_at, r.status AS request_status
       FROM requests r
       JOIN users u ON u.id = CASE WHEN r.sender_id=$1 THEN r.receiver_id ELSE r.sender_id END
       WHERE (r.sender_id=$1 OR r.receiver_id=$1) AND r.status <> 'closed'
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
       ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 200`,
      [viewer.id],
    )
  ).rows;
  const map = (r: any, dir: 'received' | 'sent') => ({
    id: r.request_id,
    status: r.request_status,
    senderScore: r.sender_score,
    receiverScore: r.receiver_score,
    note: r.note,
    likedPrompt: r.liked_prompt || '',
    likedAnswer: r.liked_prompt ? ((dir === 'received' ? viewer : r).prompts || []).find((p: any) => p.q === r.liked_prompt)?.a || '' : '',
    createdAt: r.request_created_at,
    respondedAt: r.responded_at,
    user: publicProfile(r as UserRow, viewer, { connected: r.request_status === 'accepted' }),
  });
  res.json({
    received: rows.filter((r) => r.receiver_id === viewer.id && r.request_status !== 'cancelled').map((r) => map(r, 'received')),
    sent: rows.filter((r) => r.sender_id === viewer.id).map((r) => map(r, 'sent')),
  });
});

async function ownRequest(id: string, uid: string, role: 'sender' | 'receiver') {
  if (!isUuid(id)) throw notFound('Request not found');
  const r = (await q(`SELECT * FROM requests WHERE id=$1 AND ${role}_id=$2`, [id, uid])).rows[0];
  if (!r) throw notFound('Request not found');
  return r;
}

social.post('/requests/:id/decline', async (req, res) => {
  const r = await ownRequest(param(req, 'id'), req.user.uid, 'receiver');
  if (r.status !== 'pending') throw conflict('This request is no longer pending', 'not_pending');
  await q(`UPDATE requests SET status='declined', responded_at=now() WHERE id=$1`, [r.id]);
  emit(r.sender_id, 'request:update', { requestId: r.id });
  res.json({ ok: true });
});

social.post('/requests/:id/cancel', async (req, res) => {
  const r = await ownRequest(param(req, 'id'), req.user.uid, 'sender');
  if (r.status !== 'pending') throw conflict('This request is no longer pending', 'not_pending');
  await q(`UPDATE requests SET status='cancelled', responded_at=now() WHERE id=$1`, [r.id]);
  emit(r.receiver_id, 'request:update', { requestId: r.id });
  res.json({ ok: true });
});

/* ---------------- MATCHES & MESSAGES ---------------- */

async function ownMatch(id: string, uid: string) {
  if (!isUuid(id)) throw notFound('Conversation not found');
  const m = (await q(`SELECT * FROM requests WHERE id=$1 AND (sender_id=$2 OR receiver_id=$2)`, [id, uid])).rows[0];
  if (!m || m.status !== 'accepted') throw notFound('Conversation not found');
  const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
  if (await isBlocked(uid, otherId)) throw notFound('Conversation not found');
  return { m, otherId };
}

function matchScores(m: any, uid: string) {
  const iAmSender = m.sender_id === uid;
  return { mine: iAmSender ? m.sender_score : m.receiver_score, theirs: iAmSender ? m.receiver_score : m.sender_score };
}

social.get('/matches', async (req, res) => {
  const viewer = await me(req);
  const rows = (
    await q(
      `SELECT r.id AS match_id, r.sender_id, r.receiver_id, r.sender_score, r.receiver_score, r.responded_at, r.last_message_at, u.*,
         lm.body AS last_body, lm.sender_id AS last_sender, lm.created_at AS last_at,
         (SELECT count(*) FROM messages m WHERE m.match_id=r.id AND m.sender_id<>$1 AND m.read_at IS NULL)::int AS unread
       FROM requests r
       JOIN users u ON u.id = CASE WHEN r.sender_id=$1 THEN r.receiver_id ELSE r.sender_id END
       LEFT JOIN LATERAL (SELECT body, sender_id, created_at FROM messages WHERE match_id=r.id ORDER BY id DESC LIMIT 1) lm ON true
       WHERE (r.sender_id=$1 OR r.receiver_id=$1) AND r.status='accepted'
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
       ORDER BY coalesce(r.last_message_at, r.responded_at) DESC NULLS LAST`,
      [viewer.id],
    )
  ).rows;
  res.json({
    matches: rows.map((r) => ({
      id: r.match_id,
      user: publicProfile(r as UserRow, viewer, { connected: true }),
      scores: matchScores(r, viewer.id),
      lastMessage: r.last_body ? { body: r.last_body, fromMe: r.last_sender === viewer.id, at: r.last_at } : null,
      unread: r.unread,
      connectedAt: r.responded_at,
    })),
  });
});

social.get('/matches/:id', async (req, res) => {
  const viewer = await me(req);
  const { m, otherId } = await ownMatch(param(req, 'id'), viewer.id);
  const other = await loadUser(otherId);
  if (!other) throw notFound('Conversation not found');
  res.json({ id: m.id, user: publicProfile(other, viewer, { connected: true }), scores: matchScores(m, viewer.id), connectedAt: m.responded_at, online: isOnline(otherId) });
});

social.get('/matches/:id/messages', async (req, res) => {
  const { m } = await ownMatch(param(req, 'id'), req.user.uid);
  const before = Number(req.query.before) || null;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const rows = (
    await q(
      `SELECT id, sender_id, body, client_id, created_at, read_at FROM messages
       WHERE match_id=$1 AND ($2::bigint IS NULL OR id < $2) ORDER BY id DESC LIMIT $3`,
      [m.id, before, limit + 1],
    )
  ).rows;
  const hasMore = rows.length > limit;
  res.json({ messages: rows.slice(0, limit).reverse().map((x) => ({ ...x, id: Number(x.id) })), hasMore });
});

const msgSchema = z.object({ body: z.string().trim().min(1, 'empty message').max(2000), clientId: z.string().max(64).optional() });

social.post('/matches/:id/messages', msgLimiter, async (req, res) => {
  const viewer = await me(req);
  const { m, otherId } = await ownMatch(param(req, 'id'), viewer.id);
  const { body, clientId } = parse(msgSchema, req.body);
  let row = (
    await q(
      `INSERT INTO messages (match_id, sender_id, body, client_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (sender_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id, match_id, sender_id, body, client_id, created_at, read_at`,
      [m.id, viewer.id, body, clientId || null],
    )
  ).rows[0];
  if (!row) {
    // Duplicate retry — return the original message.
    row = (await q('SELECT id, match_id, sender_id, body, client_id, created_at, read_at FROM messages WHERE sender_id=$1 AND client_id=$2', [viewer.id, clientId])).rows[0];
    return res.json({ message: { ...row, id: Number(row.id) } });
  }
  await q('UPDATE requests SET last_message_at=now() WHERE id=$1', [m.id]);
  const msg = { ...row, id: Number(row.id) };
  emit(otherId, 'message', msg);
  emit(viewer.id, 'message', msg);
  if (!isOnline(otherId)) emails.newMessage(otherId, viewer.name.split(' ')[0], m.id);
  res.json({ message: msg });
});

social.post('/matches/:id/read', async (req, res) => {
  const { m, otherId } = await ownMatch(param(req, 'id'), req.user.uid);
  const r = await q(`UPDATE messages SET read_at=now() WHERE match_id=$1 AND sender_id<>$2 AND read_at IS NULL`, [m.id, req.user.uid]);
  if ((r.rowCount ?? 0) > 0) emit(otherId, 'read', { matchId: m.id, at: new Date() });
  res.json({ ok: true });
});

social.post('/matches/:id/unmatch', async (req, res) => {
  const { m, otherId } = await ownMatch(param(req, 'id'), req.user.uid);
  await q(`UPDATE requests SET status='unmatched' WHERE id=$1`, [m.id]);
  emit(otherId, 'match:removed', { matchId: m.id });
  res.json({ ok: true });
});

export { forbidden };
