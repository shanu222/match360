import type { Request } from 'express';
import { q } from '../db.js';
import { HttpError, notFound } from '../http.js';
import type { UserRow } from '../profiles.js';

export async function loadUser(id: string): Promise<UserRow | null> {
  const r = await q<UserRow>('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}

/** Loads the signed-in user and requires a completed profile. */
export async function me(req: Request, { requireProfile = true } = {}): Promise<UserRow> {
  const u = await loadUser(req.user.uid);
  if (!u) throw new HttpError(401, 'Please sign in', 'unauthenticated');
  if (requireProfile && !u.onboarded) throw new HttpError(403, 'Complete your profile first', 'complete_profile');
  return u;
}

export async function isBlocked(a: string, b: string) {
  const r = await q('SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1', [a, b]);
  return (r.rowCount ?? 0) > 0;
}

/** Loads another member that the viewer is allowed to see. */
export async function visibleUser(viewerId: string, id: string) {
  if (!id || id === viewerId) throw notFound('Profile not found');
  const u = await loadUser(id);
  if (!u || !u.onboarded || (await isBlocked(viewerId, id))) throw notFound('Profile not found');
  return u;
}

export const param = (req: Request, name: string) => String((req.params as Record<string, string>)[name] || '');
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
