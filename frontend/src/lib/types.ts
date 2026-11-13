export interface Prompt { q: string; a: string }

export interface Profile {
  id: string;
  name: string;
  firstName: string;
  age: number | null;
  gender: string;
  country: string;
  countryName: string;
  city: string;
  hometown: string;
  job: string;
  company: string;
  industry: string;
  educationLevel: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  bio: string;
  prompts: Prompt[];
  heightCm: number | null;
  maritalStatus: string;
  children: string;
  religion: string;
  smoking: string;
  drinking: string;
  photos: string[];
  photosBlurred: boolean;
  verified: boolean;
  premium: boolean;
  threshold: number;
  compatibility: number;
  sharedInterests: string[];
  distanceKm: number | null;
  activeRecently: boolean;
  lastSeen: string;
}

export interface Me extends Profile {
  email: string;
  emailVerified: boolean;
  dob: string | null;
  interestedIn: string;
  photosBlur: string[];
  photoBlur: boolean;
  hasLocation: boolean;
  onboarded: boolean;
  incognito: boolean;
  emailNotifications: boolean;
  premiumUntil: string | null;
  status: string;
  createdAt: string;
}

export interface Stats {
  challengesTaken: number;
  avgScore: number;
  perfectScores: number;
  connections: number;
  requestsReceived: number;
  messagesSent: number;
}
export interface Counts { pendingRequests: number; unreadNotifications: number; unreadMessages: number }
export interface MeResponse { user: Me; stats: Stats; counts: Counts; missing: string[]; verification: 'none' | 'pending' | 'approved' | 'rejected' }

export interface Meta {
  intents: string[];
  genders: string[];
  interestedIn: string[];
  interests: string[];
  prompts: string[];
  educationLevels: string[];
  industries: string[];
  marital: string[];
  children: string[];
  smoking: string[];
  drinking: string[];
  religions: string[];
  uploadsEnabled: boolean;
  maxPhotos: number;
}
export interface Country { code: string; name: string; flag: string; phone: string }

export interface Plan { id: string; name: string; months: number; pricePKR: number; priceUSD: number; highlight?: boolean }
export interface PaymentMethod { id: string; name: string; enabled: boolean; currency: 'PKR' | 'USD'; details: { label: string; value: string }[]; link?: string; instructions: string }
export interface AppConfig {
  plans: Plan[];
  paymentMethods: PaymentMethod[];
  ads: { enabled: boolean; adsenseClient: string; slotDiscover: string; slotChats: string };
  limits: { freeDailyChallenges: number; premiumDailyChallenges: number; freeRetakeHours: number; premiumRetakeHours: number };
  premium: boolean;
  premiumUntil: string | null;
}
export interface Payment { id: string; plan: string; months: number; amount: string | number; currency: string; method: string; reference: string; status: 'pending' | 'approved' | 'rejected'; note: string; created_at: string }
export interface Verification { id: string; doc_type: string; status: 'pending' | 'approved' | 'rejected'; note: string; created_at: string }

export type Relation =
  | { type: 'none' }
  | { type: 'in_progress' }
  | { type: 'matched'; matchId: string }
  | { type: 'sent'; requestId: string; status: string; score: number }
  | { type: 'received'; requestId: string; status: string; score: number }
  | { type: 'ready_to_send'; attemptId: string; score: number }
  | { type: 'cooldown'; retryAt: string };

export interface QuizStart {
  attemptId: string;
  purpose: 'request' | 'accept';
  target: { id: string; firstName: string; photo: string | null; threshold: number };
  questions: { q: string; options: string[] }[];
  secondsPerQuestion: number;
  expiresAt: string;
  serverNow: string;
}
export interface QuizResult {
  attemptId: string;
  purpose: 'request' | 'accept';
  score: number;
  correct: number;
  total: number;
  review: { q: string; options: string[]; correctIndex: number; yourIndex: number }[];
  meetsThreshold: boolean;
  threshold: number;
  matchId?: string | null;
}

export interface RequestItem {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'unmatched';
  senderScore: number;
  receiverScore: number | null;
  note: string;
  createdAt: string;
  respondedAt: string | null;
  user: Profile;
}

export interface MatchItem {
  id: string;
  user: Profile;
  scores: { mine: number | null; theirs: number | null };
  lastMessage: { body: string; fromMe: boolean; at: string } | null;
  unread: number;
  connectedAt: string;
}

export interface Message {
  id: number;
  match_id?: string;
  sender_id: string;
  body: string;
  client_id: string | null;
  created_at: string;
  read_at: string | null;
  pending?: boolean;
  failed?: boolean;
}

export interface Notification {
  id: number;
  type: string;
  body: string;
  ref_id: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_photo: string | null;
}
