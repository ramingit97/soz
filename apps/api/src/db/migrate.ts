/**
 * Run this once to create all tables:
 *   pnpm --filter api exec tsx src/db/migrate.ts
 *
 * Uses drizzle-kit push (no migration files needed for MVP).
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';

import { getDb, isDbAvailable } from './client.js';

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id TEXT;

-- One guest account per device: the trial resumes instead of forking on relaunch.
CREATE UNIQUE INDEX IF NOT EXISTS users_device_id_uniq
  ON users (device_id) WHERE device_id IS NOT NULL;

-- Server-side entitlement (RevenueCat webhook writes it; the client cannot).
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS revenuecat_user_id TEXT;

-- Session revocation. Existing rows start at 0, which is also what a token
-- issued before this column existed reports, so nobody is logged out by the
-- migration itself.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS users_revenuecat_uniq
  ON users (revenuecat_user_id) WHERE revenuecat_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_codes_lookup
  ON auth_codes (email, purpose, used);

CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'beginner',
  learning_languages JSONB NOT NULL DEFAULT '[]',
  schedule_days JSONB NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]',
  schedule_minutes INTEGER NOT NULL DEFAULT 15,
  schedule_hour INTEGER NOT NULL DEFAULT 17,
  current_day INTEGER NOT NULL DEFAULT 1,
  total_stars INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date TEXT,
  age_band TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE children ADD COLUMN IF NOT EXISTS interests JSONB NOT NULL DEFAULT '[]';
ALTER TABLE children ADD COLUMN IF NOT EXISTS lesson_prefs JSONB;
ALTER TABLE children ADD COLUMN IF NOT EXISTS age_band TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'kid';
ALTER TABLE children ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS goals JSONB NOT NULL DEFAULT '[]';
ALTER TABLE children ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS proactive_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE children ADD COLUMN IF NOT EXISTS proactive_window_start INTEGER NOT NULL DEFAULT 16;
ALTER TABLE children ADD COLUMN IF NOT EXISTS proactive_window_end INTEGER NOT NULL DEFAULT 19;
ALTER TABLE children ADD COLUMN IF NOT EXISTS last_proactive_sent_date TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS ignored_proactive_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS child_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  facts JSONB NOT NULL DEFAULT '[]',
  things_to_ask_back JSONB NOT NULL DEFAULT '[]',
  last_interaction_date TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, language)
);

CREATE TABLE IF NOT EXISTS memory_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT,
  sentiment TEXT,
  sensitive INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  mentioned_at TEXT NOT NULL,
  event_date TEXT,
  follow_up_at TEXT,
  asked_at TEXT,
  resolved_at TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_threads_due
  ON memory_threads (child_id, language, status, follow_up_at);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  day INTEGER NOT NULL,
  stars_earned INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, language, day)
);

ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS errors JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  day INTEGER NOT NULL DEFAULT 1,
  turns JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  age_min INTEGER NOT NULL DEFAULT 8,
  age_max INTEGER NOT NULL DEFAULT 12,
  day_slot INTEGER NOT NULL,
  content JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  quality_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lesson_templates_lookup
  ON lesson_templates (language, level, day_slot);

CREATE TABLE IF NOT EXISTS child_curricula (
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  day INTEGER NOT NULL,
  template_id UUID NOT NULL REFERENCES lesson_templates(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (child_id, language, day)
);

ALTER TABLE child_curricula ADD COLUMN IF NOT EXISTS content JSONB;
ALTER TABLE child_curricula ADD COLUMN IF NOT EXISTS personalized_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS generated_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  start_day INTEGER NOT NULL,
  end_day INTEGER NOT NULL,
  lessons JSONB NOT NULL,
  analysis JSONB NOT NULL,
  week_rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  UNIQUE(child_id, language, week_number)
);

CREATE TABLE IF NOT EXISTS listening_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listening_stories_child ON listening_stories (child_id);

ALTER TABLE children ADD COLUMN IF NOT EXISTS pet_name TEXT;
ALTER TABLE listening_stories ADD COLUMN IF NOT EXISTS phrases JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id TEXT,
  conversation_id TEXT,
  reason TEXT,
  message_text TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_reports_triage ON ai_reports (reviewed, created_at);

-- Real-time crisis escalation. The parent alert used to be a local notification
-- fired by the CHILD's device, so a closed app meant nobody was told. The server
-- escalates now, and this is the durable record that it did.
CREATE TABLE IF NOT EXISTS safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'crisis',
  category TEXT,
  language TEXT NOT NULL,
  conversation_id TEXT,
  degraded INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drives the per-child email cooldown and the operator triage view.
CREATE INDEX IF NOT EXISTS safety_alerts_child ON safety_alerts (child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS safety_alerts_triage ON safety_alerts (email_status, created_at DESC);

-- Daily AI spend. Upserted by services/spend.ts on every AI call.
CREATE TABLE IF NOT EXISTS ai_spend_daily (
  day TEXT PRIMARY KEY,
  usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  by_kind JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function runMigrations() {
  if (!isDbAvailable()) {
    console.error('DATABASE_URL not set — skipping migrations.');
    process.exit(1);
  }

  const db = getDb();
  console.log('Running migrations...');
  await db.execute(sql.raw(CREATE_TABLES));
  console.log('✅ All tables created (or already exist).');
  process.exit(0);
}

runMigrations().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
