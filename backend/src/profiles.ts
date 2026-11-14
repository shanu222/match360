import { countryName, distanceKm } from './geo.js';
import { presence } from './presence.js';

export interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  name: string;
  dob: string | Date | null;
  gender: string;
  interested_in: string;
  country: string;
  city: string;
  hometown: string;
  lat: number | null;
  lng: number | null;
  job: string;
  company: string;
  industry: string;
  education_level: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  bio: string;
  prompts: { q: string; a: string }[];
  height_cm: number | null;
  marital_status: string;
  children: string;
  religion: string;
  smoking: string;
  drinking: string;
  photos: string[];
  photos_blurred: string[];
  photo_blur: boolean;
  id_verified: boolean;
  status: string;
  status_reason: string;
  premium_until: Date | null;
  store_premium_until: Date | null;
  threshold: number;
  onboarded: boolean;
  incognito: boolean;
  email_notifications: boolean;
  welcomed: boolean;
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

export const isPremium = (u: Pick<UserRow, 'premium_until'>) => Boolean(u.premium_until && new Date(u.premium_until).getTime() > Date.now());

export function compat(me: Pick<UserRow, 'interests' | 'intent' | 'city'> | null, u: Pick<UserRow, 'interests' | 'intent' | 'city'>) {
  if (!me) return { score: 0, shared: [] as string[] };
  const shared = u.interests.filter((i) => me.interests.includes(i));
  const s = 35 + shared.length * 9 + (u.intent === me.intent ? 15 : 0) + (u.city && u.city === me.city ? 8 : 0);
  return { score: Math.max(0, Math.min(98, s)), shared };
}

const ACTIVE_MS = 5 * 60_000;
const NEW_MS = 7 * 24 * 3600_000;

/**
 * Profile as other members see it. Never includes email, exact birthday or coordinates.
 * Photos are served blurred when the owner chose blur, until the two are connected.
 */
export function publicProfile(u: UserRow, viewer: UserRow | null, opts: { connected?: boolean } = {}) {
  const c = compat(viewer, u);
  const blurred = u.photo_blur && !opts.connected && viewer?.id !== u.id;
  let distance: number | null = null;
  if (viewer && viewer.id !== u.id && viewer.lat != null && viewer.lng != null && u.lat != null && u.lng != null) {
    distance = Math.max(1, Math.round(distanceKm(viewer.lat, viewer.lng, u.lat, u.lng)));
  }
  return {
    id: u.id,
    name: u.name,
    firstName: u.name.split(' ')[0],
    age: ageFrom(u.dob),
    gender: u.gender,
    country: u.country,
    countryName: countryName(u.country),
    city: u.city,
    hometown: u.hometown,
    job: u.job,
    company: u.company,
    industry: u.industry,
    educationLevel: u.education_level,
    education: u.education,
    languages: u.languages,
    intent: u.intent,
    interests: u.interests,
    bio: u.bio,
    prompts: (u.prompts || []).filter((p) => p && p.a),
    heightCm: u.height_cm,
    maritalStatus: u.marital_status,
    children: u.children,
    religion: u.religion,
    smoking: u.smoking,
    drinking: u.drinking,
    // Never fall back to a clear photo while blur is on.
    photos: blurred ? (u.photos_blurred.length === u.photos.length && u.photos_blurred.every((b, i) => b && b !== u.photos[i]) ? u.photos_blurred : []) : u.photos,
    photosBlurred: blurred,
    verified: u.id_verified,
    premium: isPremium(u),
    threshold: u.threshold,
    compatibility: c.score,
    sharedInterests: c.shared,
    distanceKm: distance,
    activeRecently: Date.now() - new Date(u.last_seen).getTime() < ACTIVE_MS,
    // Connected right now on the website or in the app (the same for both), or seen in the last few minutes.
    online: presence.isOnline(u.id) || Date.now() - new Date(u.last_seen).getTime() < ACTIVE_MS,
    isNew: Date.now() - new Date(u.created_at).getTime() < NEW_MS,
    lastSeen: u.last_seen,
  };
}

export function privateProfile(u: UserRow) {
  return {
    ...publicProfile(u, null),
    photos: u.photos,
    photosBlur: u.photos_blurred,
    photoBlur: u.photo_blur,
    photosBlurred: false,
    email: u.email,
    emailVerified: u.email_verified,
    dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : null,
    interestedIn: u.interested_in,
    hasLocation: u.lat != null,
    onboarded: u.onboarded,
    incognito: u.incognito,
    emailNotifications: u.email_notifications,
    premiumUntil: u.premium_until,
    status: u.status,
    createdAt: u.created_at,
  };
}

/** Fields required before a profile goes live — keeps the community serious. */
export function missingFields(u: UserRow): string[] {
  const m: string[] = [];
  const age = ageFrom(u.dob);
  if (u.name.trim().length < 2) m.push('name');
  if (age === null || age < 18) m.push('date of birth');
  if (!u.gender) m.push('gender');
  if (!u.country) m.push('country');
  if (!u.city) m.push('city');
  if (!u.job) m.push('job title');
  if (!u.company) m.push('workplace');
  if (!u.industry) m.push('industry');
  if (!u.education_level) m.push('education level');
  if (!u.education) m.push('school or university');
  if (!u.languages) m.push('languages');
  if (!u.intent) m.push('what you are looking for');
  if (u.interests.length < 5) m.push('at least 5 interests');
  if ((u.bio || '').trim().length < 80) m.push('an "About me" of at least 80 characters');
  if ((u.prompts || []).filter((p) => p.a && p.a.trim().length >= 3).length < 3) m.push('answers to 3 prompts');
  return m;
}
export const isComplete = (u: UserRow) => missingFields(u).length === 0;
