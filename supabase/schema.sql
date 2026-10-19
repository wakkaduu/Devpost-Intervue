-- Intervue database schema.
-- Run once in a fresh Supabase project: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run: everything uses IF NOT EXISTS.

-- Accounts. Passwords are stored only as bcrypt hashes. OAuth users have no password_hash.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  image TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  confirmation_code_hash TEXT,
  confirmation_code_expires TIMESTAMPTZ,
  confirmation_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One account per email, regardless of capitalisation.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

-- Completed practice sessions. The primary key is (user_id, id): the id comes from the browser,
-- so scoping it to the user means nobody can overwrite another person's session by reusing an id,
-- and saving the same session twice updates one row instead of adding a second chart point.
CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'typed' CHECK (mode IN ('typed', 'mic')),
  average_score NUMERIC(3, 1) NOT NULL CHECK (average_score >= 1 AND average_score <= 10),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  entries JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS interview_sessions_user_created_idx ON interview_sessions (user_id, created_at DESC);

-- The app talks to the database only from the server, using the service-role key (which bypasses
-- row-level security). Turning RLS on with no policies means the public anon key can read nothing.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
