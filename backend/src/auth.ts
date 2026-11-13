import type { NextFunction, Request, Response } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';
import { q } from './db.js';
import { HttpError } from './http.js';

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

let firebaseReady = false;
export function initFirebase() {
  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[auth] Firebase Admin credentials missing — authenticated routes will return 503');
    return;
  }
  try {
    if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    firebaseReady = true;
    console.log('[auth] Firebase Admin ready');
  } catch (e: any) {
    // Never crash the server on bad credentials — log clearly and keep serving (auth routes return 503).
    console.error('[auth] Invalid Firebase Admin credentials — check FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY:', e?.message);
  }
}

export async function verifyToken(token: string): Promise<AuthUser> {
  if (config.testAuth && token.startsWith('test:')) {
    const [, uid, email] = token.split(':');
    return { uid, email: email || `${uid}@test.local`, emailVerified: true };
  }
  if (!firebaseReady) throw new HttpError(503, 'Authentication is not configured on the server', 'auth_unavailable');
  try {
    const d = await getAuth().verifyIdToken(token);
    return { uid: d.uid, email: d.email || '', emailVerified: Boolean(d.email_verified) };
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.', 'unauthenticated');
  }
}

export async function deleteFirebaseUser(uid: string) {
  if (!firebaseReady) return;
  await getAuth().deleteUser(uid).catch((e) => console.warn('[auth] deleteUser failed', e?.message));
}

const statusCache = new Map<string, { status: string; at: number }>();
async function isSuspended(uid: string) {
  const r = await q<{ status: string }>('SELECT status FROM users WHERE id=$1', [uid]);
  const status = r.rows[0]?.status || 'active';
  statusCache.set(uid, { status, at: Date.now() });
  if (statusCache.size > 10000) statusCache.clear();
  return status !== 'active';
}
export function clearStatusCache(uid: string) {
  statusCache.delete(uid);
}

// Small cache so we don't write to the users table on every request.
const seen = new Map<string, number>();

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new HttpError(401, 'Please sign in', 'unauthenticated');
    const user = await verifyToken(token);
    req.user = user;
    const blocked = statusCache.get(user.uid);
    if (blocked && Date.now() - blocked.at < 60_000 ? blocked.status !== 'active' : await isSuspended(user.uid)) {
      throw new HttpError(403, 'This account has been suspended. Contact support if you think this is a mistake.', 'suspended');
    }
    const key = `${user.uid}|${user.email}|${user.emailVerified}`;
    const last = seen.get(key) || 0;
    if (Date.now() - last > 60_000) {
      await q(
        `INSERT INTO users (id, email, email_verified) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, email_verified = EXCLUDED.email_verified, last_seen = now()`,
        [user.uid, user.email, user.emailVerified],
      );
      seen.set(key, Date.now());
      if (seen.size > 5000) seen.clear();
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function forgetUser(uid: string) {
  for (const k of seen.keys()) if (k.startsWith(uid + '|')) seen.delete(k);
}
