export interface Prompt { q: string; a: string }

export interface Profile {
  id: string;
  name: string;
  firstName: string;
  age: number | null;
  city: string;
  job: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  bio: string;
  prompts: Prompt[];
  photos: string[];
  verified: boolean;
  threshold: number;
  compatibility: number;
  sharedInterests: string[];
  activeRecently: boolean;
  lastSeen: string;
}

export interface Me extends Profile {
  email: string;
  dob: string | null;
  onboarded: boolean;
  incognito: boolean;
  emailNotifications: boolean;
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
export interface MeResponse { user: Me; stats: Stats; counts: Counts }

export interface Meta {
  intents: string[];
  interests: string[];
  cities: string[];
  prompts: string[];
  uploadsEnabled: boolean;
  maxPhotos: number;
}

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
