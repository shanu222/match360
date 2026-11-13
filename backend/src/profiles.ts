export interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  dob: string | Date | null;
  city: string;
  job: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  bio: string;
  prompts: { q: string; a: string }[];
  photos: string[];
  threshold: number;
  onboarded: boolean;
  incognito: boolean;
  email_notifications: boolean;
  last_seen: Date;
  created_at: Date;
}

export function ageFrom(dob: string | Date | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

export function compat(me: Pick<UserRow, 'interests' | 'intent' | 'city'> | null, u: Pick<UserRow, 'interests' | 'intent' | 'city'>) {
  if (!me) return { score: 0, shared: [] as string[] };
  const shared = u.interests.filter((i) => me.interests.includes(i));
  let s = 40 + shared.length * 10 + (u.intent === me.intent ? 15 : 0) + (u.city && u.city === me.city ? 8 : 0);
  return { score: Math.max(0, Math.min(98, s)), shared };
}

const ACTIVE_MS = 5 * 60_000;

/** Profile as other members see it. Never includes email or date of birth. */
export function publicProfile(u: UserRow, viewer: UserRow | null) {
  const c = compat(viewer, u);
  return {
    id: u.id,
    name: u.name,
    firstName: u.name.split(' ')[0],
    age: ageFrom(u.dob),
    city: u.city,
    job: u.job,
    education: u.education,
    languages: u.languages,
    intent: u.intent,
    interests: u.interests,
    bio: u.bio,
    prompts: (u.prompts || []).filter((p) => p && p.a),
    photos: u.photos,
    verified: u.email_verified,
    threshold: u.threshold,
    compatibility: c.score,
    sharedInterests: c.shared,
    activeRecently: Date.now() - new Date(u.last_seen).getTime() < ACTIVE_MS,
    lastSeen: u.last_seen,
  };
}

export function privateProfile(u: UserRow) {
  return {
    ...publicProfile(u, null),
    email: u.email,
    dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : null,
    onboarded: u.onboarded,
    incognito: u.incognito,
    emailNotifications: u.email_notifications,
    createdAt: u.created_at,
  };
}

export function isComplete(u: Pick<UserRow, 'name' | 'dob' | 'city' | 'job' | 'intent' | 'interests' | 'prompts'>) {
  const age = ageFrom(u.dob);
  return Boolean(
    u.name.trim().length >= 2 &&
      age !== null &&
      age >= 18 &&
      u.city &&
      u.job &&
      u.intent &&
      u.interests.length >= 3 &&
      (u.prompts || []).filter((p) => p.a && p.a.trim()).length >= 2,
  );
}
