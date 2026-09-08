import {
  doublePrecision,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Users (parents) ──────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: integer('email_verified').notNull().default(0), // 0/1 — int instead of bool to keep migrations simple
  // Anonymous trial accounts. A guest row is a REAL user (children/progress hang
  // off it), created on first launch and bound to the device so the same install
  // always resumes the same trial. Registering upgrades the row in place —
  // isGuest → 0, deviceId → NULL — so day-1 progress survives sign-up.
  isGuest: integer('is_guest').notNull().default(0), // 0/1
  deviceId: text('device_id').unique(),
  // Entitlement, owned by the SERVER. The client's `isPremium` lives in
  // AsyncStorage and is editable on a rooted device, so it can gate UI but must
  // never gate spend. RevenueCat is the source of truth and pushes changes here
  // via webhook; null = never subscribed, past = lapsed.
  premiumUntil: timestamp('premium_until', { withTimezone: true }),
  // RevenueCat's app_user_id for this account, so a webhook can find the row.
  revenuecatUserId: text('revenuecat_user_id').unique(),
  // Bumped whenever every existing session must stop working — today that means a
  // password reset. Tokens live 30 days, so without this a parent who resets a
  // password because someone else got into the account changes nothing: the
  // intruder's token keeps working for the rest of the month.
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Short-lived 6-digit codes for password reset & email verification
export const authCodes = pgTable('auth_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  purpose: text('purpose').notNull(), // 'password_reset' | 'email_verify'
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: integer('used').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Children profiles ────────────────────────────────────────────────────────

// Parent "dials" set at the post-week checkpoint — steer future lessons on top of
// interests. Only knobs the app can actually deliver (NO video — doesn't exist).
export interface LessonPrefs {
  moreTalk?: boolean; // weight lessons toward more Bobo conversation
  moreWords?: boolean; // teach a bit more vocabulary per lesson
  difficulty?: 'easier' | 'harder'; // pacing nudge (keeps the skeleton)
}

export const children = pgTable('children', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  level: text('level').notNull().default('beginner'),
  learningLanguages: json('learning_languages')
    .$type<string[]>()
    .notNull()
    .default([]),
  // Free-form interests captured at onboarding (AI-extracted tags, e.g. 'dinos',
  // 'space', 'животные'). Personalize Bobo's conversations + AI-generated weeks.
  interests: json('interests').$type<string[]>().notNull().default([]),
  // Parent steering from the post-week checkpoint (more talk / more words / pacing).
  lessonPrefs: json('lesson_prefs').$type<LessonPrefs>(),
  scheduleDays: json('schedule_days')
    .$type<string[]>()
    .notNull()
    .default(['mon', 'tue', 'wed', 'thu', 'fri']),
  scheduleMinutes: integer('schedule_minutes').notNull().default(15),
  scheduleHour: integer('schedule_hour').notNull().default(17),
  ageBand: text('age_band'), // 'young' (5-7) | 'mid' (8-12) | 'teen' (13+) | 'adult' (18+)
  petName: text('pet_name'), // kid-chosen companion name; AI persona uses it (defaults to "Bobo")
  // Profile kind: a 'kid' profile (parent-managed) or an 'adult' learner profile
  // on the same family account. Drives persona, proactive gating, paywall, metrics.
  profileType: text('profile_type').notNull().default('kid'), // 'kid' | 'adult'
  goal: text('goal'), // PRIMARY goal (goals[0]) — kept for back-compat / single-goal reads
  goals: json('goals').$type<string[]>().notNull().default([]), // all chosen "why learning" goals (kid path: up to 2)
  timezone: text('timezone'), // IANA tz e.g. 'Asia/Baku' — proactive daytime window (buildTimeContext uses server time today)
  // Proactive "Хани messages first" — kids: parent opt-in, default OFF (0).
  proactiveOptIn: integer('proactive_opt_in').notNull().default(0), // 0/1
  proactiveWindowStart: integer('proactive_window_start').notNull().default(16), // local hour
  proactiveWindowEnd: integer('proactive_window_end').notNull().default(19),
  lastProactiveSentDate: text('last_proactive_sent_date'), // ISO — caps to ≤1/day
  ignoredProactiveCount: integer('ignored_proactive_count').notNull().default(0), // auto-stop after a few ignores
  currentDay: integer('current_day').notNull().default(1),
  totalStars: integer('total_stars').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  lastCompletedDate: text('last_completed_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Lesson progress ──────────────────────────────────────────────────────────

export interface LessonError {
  kind: 'word_game' | 'grammar' | 'pronunciation';
  prompt: string;
  correct: string;
  given: string;
}

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    day: integer('day').notNull(),
    starsEarned: integer('stars_earned').notNull().default(0),
    errors: json('errors').$type<LessonError[]>().notNull().default([]),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('progress_uniq').on(t.childId, t.language, t.day)],
);

// ── Lesson pool (shared templates for days 1-30, tagged by profile) ─────────

/**
 * The pedagogical FOCUS of a day — drives which activity is the hero in the daily
 * path. The week-plan distributes these so the learner's weekly time is balanced
 * (guaranteed ≥1 story_listen + ≥1 conversation per active week). 'vocab_grammar'
 * is the default all-rounder day; absent/undefined is treated as 'vocab_grammar'.
 */
export type LessonFocus = 'story_listen' | 'conversation' | 'vocab_grammar' | 'review';

export interface LessonContent {
  theme: string;
  themeEmoji: string;
  focus?: LessonFocus;
  vocabulary: string[];
  story: { text: string; emoji: string }[];
  wordGame: { emoji: string; correct: string; options: string[] }[];
  grammar: {
    kind: 'fill_blank' | 'order_words';
    prompt: string;
    options: string[];
    correct: string | string[];
  }[];
  talkSystemPrompt: string;
  reward: { stars: number; message: string };
}

export const lessonTemplates = pgTable(
  'lesson_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    language: text('language').notNull(),
    level: text('level').notNull(), // 'beginner' | 'elementary' | 'pre_intermediate'
    ageMin: integer('age_min').notNull().default(8),
    ageMax: integer('age_max').notNull().default(12),
    daySlot: integer('day_slot').notNull(), // 1..30
    content: json('content').$type<LessonContent>().notNull(),
    source: text('source').notNull().default('manual'), // 'manual' | 'ai'
    qualityScore: integer('quality_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
);

export const childCurricula = pgTable(
  'child_curricula',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    day: integer('day').notNull(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => lessonTemplates.id, { onDelete: 'restrict' }),
    // Per-child personalized ("interest-skinned") version of the template content.
    // NULL = not yet skinned → serve the shared template as fallback. Keeps the
    // pedagogical skeleton (theme/vocabulary/grammar) but re-themes story + Bobo.
    content: json('content').$type<LessonContent>(),
    personalizedAt: timestamp('personalized_at', { withTimezone: true }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('child_curr_uniq').on(t.childId, t.language, t.day)],
);

// ── Generated weekly lesson plans (AI-personalized, days 31+) ───────────────

export interface GeneratedLesson {
  day: number;
  theme: string;
  themeEmoji: string;
  focus?: LessonFocus;
  vocabulary: string[];
  story: { text: string; emoji: string }[];
  wordGame: { emoji: string; correct: string; options: string[] }[];
  grammar: {
    kind: 'fill_blank' | 'order_words';
    prompt: string;
    options: string[];
    correct: string | string[];
  }[];
  talkSystemPrompt: string;
  reward: { stars: number; message: string };
  reasoning: string;
}

export const generatedWeeks = pgTable(
  'generated_weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    weekNumber: integer('week_number').notNull(),
    startDay: integer('start_day').notNull(),
    endDay: integer('end_day').notNull(),
    lessons: json('lessons').$type<GeneratedLesson[]>().notNull(),
    analysis: json('analysis').$type<unknown>().notNull(),
    weekRationale: text('week_rationale').notNull(),
    status: text('status').notNull().default('pending'), // pending | partial (fast day-1, days 2-7 coming) | approved | rejected
    model: text('model').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [unique('generated_weeks_uniq').on(t.childId, t.language, t.weekNumber)],
);

// ── AI listening stories (per-child, saved for re-listen; NEVER shared) ───────
export interface ListeningQuestion {
  q: string;
  options: string[];
  correct: number;
}

export interface ListeningPhrase {
  text: string;
  translation: string;
}

export const listeningStories = pgTable('listening_stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  level: text('level').notNull(),
  title: text('title').notNull(),
  text: text('text').notNull(),
  questions: json('questions').$type<ListeningQuestion[]>().notNull().default([]),
  phrases: json('phrases').$type<ListeningPhrase[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Child memory — what Bobo remembers about this child across sessions ──────

export interface ChildFact {
  category: 'interests' | 'family' | 'pets' | 'routine' | 'recent_event' | 'preferences';
  fact: string;
  mentionedAt: string; // ISO date
}

export const childMemory = pgTable(
  'child_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    facts: json('facts').$type<ChildFact[]>().notNull().default([]),
    thingsToAskBack: json('things_to_ask_back').$type<string[]>().notNull().default([]),
    lastInteractionDate: text('last_interaction_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique('child_memory_uniq').on(t.childId, t.language)],
);

// ── Memory threads — timed, proactive "friend with memory" follow-ups ────────
//
// Additive to childMemory (which stays for static facts). A thread is one
// rememberable item with a lifecycle: captured → (maybe) scheduled to ask back
// at followUpAt → asked → resolved. This is what powers Хани bringing something
// up later ("how was going out with friends?"). Read cross-language by childId
// so the timed follow-ups are not split by the childMemory UNIQUE(childId,language).

export type MemoryThreadType = 'fact' | 'event' | 'promise' | 'emotion' | 'goal';
export type MemoryThreadStatus = 'open' | 'asked' | 'resolved' | 'dismissed';
export type MemorySentiment = 'pos' | 'neu' | 'neg';

export const memoryThreads = pgTable('memory_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  type: text('type').$type<MemoryThreadType>().notNull(),
  text: text('text').notNull(),
  category: text('category'),
  sentiment: text('sentiment').$type<MemorySentiment>(),
  // Sensitive threads (fear, bullying, sadness) are NEVER sent as a proactive
  // push — they are surfaced to the parent instead.
  sensitive: integer('sensitive').notNull().default(0), // 0/1
  status: text('status').$type<MemoryThreadStatus>().notNull().default('open'),
  mentionedAt: text('mentioned_at').notNull(), // ISO date the child first said it
  eventDate: text('event_date'), // ISO date the event happens, if known ("on Saturday")
  followUpAt: text('follow_up_at'), // ISO date Хани should bring it back up (null = inject only, never push)
  askedAt: text('asked_at'),
  resolvedAt: text('resolved_at'),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Conversations (persistent history) ──────────────────────────────────────

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'set null' }),
  language: text('language').notNull(),
  day: integer('day').notNull().default(1),
  turns: json('turns')
    .$type<{ role: 'child' | 'bobo'; text: string }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── AI content reports (Google Play GenAI: users flag Хани's replies) ────────
//
// One row per in-app "flag this reply" tap. childId is stored as plain text with
// NO foreign key on purpose: a report is a moderation record that must survive
// child/account deletion, and guests (no childId) can report too. Persisted so
// the operator can actually review flagged AI output instead of losing it in the
// server log.
export const aiReports = pgTable('ai_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: text('child_id'),
  conversationId: text('conversation_id'),
  reason: text('reason'),
  messageText: text('message_text'), // the flagged Хани reply
  reviewed: integer('reviewed').notNull().default(0), // 0/1 — operator triage flag
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── Safety alerts (real-time crisis escalation) ──────────────────────────────
//
// One row per crisis flagged by the real-time screen. This exists because the
// parent alert used to be a LOCAL notification fired by the child's own device:
// if the child closed the app, killed it, or had notifications denied, nobody was
// ever told. The server knows about the crisis, so the server must be the one to
// escalate — and must leave a durable record that it did.
//
// Deliberately NO transcript column. The excerpt already lives in memory_threads
// (sensitive = 1) behind an ownership check; copying a child's crisis disclosure
// into a second table widens the blast radius of a leak and buys nothing.
export const safetyAlerts = pgTable('safety_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('crisis'), // 'crisis'
  category: text('category'), // classifier category: self_harm | abuse | violence | ...
  language: text('language').notNull(),
  conversationId: text('conversation_id'),
  // Whether the screen ran on the classifier or fell back to keywords — an alert
  // raised in degraded mode is lower-confidence and worth flagging in triage.
  degraded: integer('degraded').notNull().default(0), // 0/1
  // pending → sent | failed | skipped_guest | skipped_throttled
  emailStatus: text('email_status').notNull().default('pending'),
  emailError: text('email_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ── AI spend, one row per UTC day ────────────────────────────────────────────
//
// The daily total used to exist only on the provider invoice. `by_kind` is a map
// of "llm:gpt-5.6-terra" / "stt" / "tts" → USD so a cost spike can be attributed
// without a migration per provider.
export const aiSpendDaily = pgTable('ai_spend_daily', {
  day: text('day').primaryKey(), // YYYY-MM-DD, UTC
  usd: doublePrecision('usd').notNull().default(0),
  calls: integer('calls').notNull().default(0),
  byKind: json('by_kind').$type<Record<string, number>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
