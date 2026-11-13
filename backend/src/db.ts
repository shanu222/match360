import pg from 'pg';
import { config } from './config.js';

const needsSsl = /sslmode=require/.test(config.databaseUrl) || /\.proxy\.rlwy\.net|amazonaws|neon\.tech/.test(config.databaseUrl);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => console.error('[db] idle client error', err.message));

export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT NOT NULL DEFAULT '',
  dob DATE,
  city TEXT NOT NULL DEFAULT '',
  job TEXT NOT NULL DEFAULT '',
  education TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT '',
  interests TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT NOT NULL DEFAULT '',
  prompts JSONB NOT NULL DEFAULT '[]',
  photos TEXT[] NOT NULL DEFAULT '{}',
  threshold INT NOT NULL DEFAULT 60 CHECK (threshold BETWEEN 0 AND 100),
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  incognito BOOLEAN NOT NULL DEFAULT FALSE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_discover_idx ON users (onboarded, incognito, last_seen DESC);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('request','accept')),
  questions JSONB NOT NULL,
  answers JSONB,
  score INT,
  correct INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS quiz_pair_idx ON quiz_attempts (taker_id, target_id, purpose, started_at DESC);

CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID UNIQUE REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  sender_score INT NOT NULL,
  receiver_score INT,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','unmatched','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  UNIQUE (sender_id, receiver_id)
);
CREATE INDEX IF NOT EXISTS requests_receiver_idx ON requests (receiver_id, status);
CREATE INDEX IF NOT EXISTS requests_sender_idx ON requests (sender_id, status);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_match_idx ON messages (match_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_idx ON messages (sender_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  ref_id TEXT,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, id DESC);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS passes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reported_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: richer profiles, location, privacy, moderation, premium
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS interested_in TEXT NOT NULL DEFAULT 'Everyone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hometown TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_level TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS children TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS religion TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS smoking TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS drinking TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photos_blurred TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_blur BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcomed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rules';

CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_key TEXT NOT NULL,
  selfie_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS verifications_status_idx ON verifications (status, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  plan TEXT NOT NULL,
  months INT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT '',
  proof_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS payments_ref_idx ON payments (method, lower(reference)) WHERE status <> 'rejected';

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_log (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
`;

export async function migrate() {
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(360360)');
    await c.query(SCHEMA);
  } finally {
    await c.query('SELECT pg_advisory_unlock(360360)').catch(() => {});
    c.release();
  }
}
