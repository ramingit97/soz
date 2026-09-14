import { eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireAuth } from '../auth/middleware.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { childMemory, children, conversations, type ChildFact } from '../db/schema.js';
import { ensureCurriculaForChild } from '../services/curriculum.js';
import {
  ensureGeneratedCurriculum,
  needsGeneratedCurriculum,
  regenerateGeneratedCurriculumFrom,
} from '../services/generatedCurriculum.js';
import { invalidateLessonsFrom, personalizeWeek } from '../services/personalize.js';

export const childrenRoute = new Hono();

childrenRoute.use('*', requireAuth);

// Parent "dials" — keep in sync with LessonPrefs in db/schema.ts
const lessonPrefsSchema = z
  .object({
    moreTalk: z.boolean().optional(),
    moreWords: z.boolean().optional(),
    moreListening: z.boolean().optional(),
    difficulty: z.enum(['easier', 'harder']).optional(),
  })
  .strict();

// Human-readable "why they study" facts for the memory seed, per learning language.
const GOAL_FACT: Record<string, { ru: string; en: string }> = {
  school: { ru: 'Учит язык для школы и оценок', en: 'Is learning for school and grades' },
  future: { ru: 'Учит язык ради своего будущего', en: 'Is learning for their future' },
  move: { ru: 'Семья планирует переезд', en: 'The family plans to move abroad' },
  communication: { ru: 'Хочет свободно общаться', en: 'Wants to speak freely in conversation' },
  fun: { ru: 'Учит язык для удовольствия', en: 'Is learning for fun' },
  travel: { ru: 'Хочет путешествовать', en: 'Wants to travel' },
  career: { ru: 'Учит язык для работы и карьеры', en: 'Is learning for work and career' },
  interview: { ru: 'Готовится к собеседованию', en: 'Is preparing for a job interview' },
  family: { ru: 'Хочет общаться с близкими', en: 'Wants to talk with family' },
};

/**
 * Seed Бобо's memory from onboarding: the child TOLD us their interests and
 * goal — the companion should "remember" them from the very first conversation
 * (and the "What Бобо remembers" screen shouldn't start empty).
 */
async function seedChildMemory(
  childId: string,
  languages: string[],
  interests: string[],
  goals: string[],
): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  for (const lang of languages) {
    const ru = lang === 'ru';
    const facts: ChildFact[] = interests.slice(0, 8).map((i) => ({
      category: 'interests' as const,
      fact: ru ? `Любит ${i}` : `Loves ${i}`,
      mentionedAt: today,
    }));
    for (const g of goals) {
      const label = GOAL_FACT[g];
      if (label) {
        facts.push({ category: 'preferences', fact: ru ? label.ru : label.en, mentionedAt: today });
      }
    }
    if (facts.length === 0) continue;
    await db
      .insert(childMemory)
      .values({ childId, language: lang, facts, thingsToAskBack: [] })
      .onConflictDoNothing();
  }
}

const createChildSchema = z.object({
  name: z.string().min(1).max(40),
  age: z.number().int().min(3).max(99), // up to 99 — adult learners on a family account
  ageBand: z.enum(['young', 'mid', 'teen', 'adult']).optional(),
  petName: z.string().max(40).optional(),
  level: z.string().min(1).default('beginner'),
  learningLanguages: z.array(z.string()).min(1),
  // AI-extracted interest tags from onboarding — personalize lessons + Bobo chat
  interests: z.array(z.string().max(40)).max(12).optional(),
  lessonPrefs: lessonPrefsSchema.optional(),
  scheduleDays: z.array(z.string()).min(1),
  scheduleMinutes: z.number().int().default(15),
  scheduleHour: z.number().int().min(0).max(23).default(17),
  // Profile fork + proactive settings (all optional; sensible DB defaults otherwise)
  profileType: z.enum(['kid', 'adult']).optional(),
  goal: z.string().max(200).optional(),
  goals: z.array(z.string().max(200)).max(4).optional(),
  timezone: z.string().max(64).optional(),
  proactiveOptIn: z.number().int().min(0).max(1).optional(),
  proactiveWindowStart: z.number().int().min(0).max(23).optional(),
  proactiveWindowEnd: z.number().int().min(0).max(23).optional(),
});

const updateChildSchema = createChildSchema.partial().extend({
  currentDay: z.number().int().min(1).max(120).optional(), // 30 static + AI weeks beyond
  totalStars: z.number().int().min(0).optional(),
  streak: z.number().int().min(0).optional(),
  lastCompletedDate: z.string().nullable().optional(),
});

// GET /children — list user's children
childrenRoute.get('/', async (c) => {
  if (!isDbAvailable()) return c.json([]);
  const userId = c.get('userId');
  const db = getDb();
  const rows = await db
    .select()
    .from(children)
    .where(eq(children.userId, userId));
  return c.json(rows);
});

// POST /children — create child profile
childrenRoute.post('/', zValidator('json', createChildSchema), async (c) => {
  if (!isDbAvailable()) {
    return c.json({ error: 'database_not_configured' }, 503);
  }
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const db = getDb();

  const [child] = await db
    .insert(children)
    .values({ userId, ...body })
    .returning();

  if (!child) return c.json({ error: 'create_failed' }, 500);

  // Бобо "remembers" the onboarding answers from day 0 (non-blocking, best effort).
  seedChildMemory(
    child.id,
    body.learningLanguages,
    body.interests ?? [],
    body.goals?.length ? body.goals : body.goal ? [body.goal] : [],
  ).catch(() => {});

  const level = body.level ?? 'beginner';
  if (needsGeneratedCurriculum(level, body.ageBand)) {
    // Above beginner, or teen/adult: no curated static content fits — generate a
    // level- and age-aware curriculum. Don't block the create request on a ~30s
    // LLM week; kick it off in the background. The first curriculum fetch awaits
    // (and de-dups) week 1 if it hasn't landed yet, showing a brief loading state.
    void ensureGeneratedCurriculum(child.id, body.learningLanguages).catch(() => {});
  } else {
    // Beginner kid — assemble the curated 30-day curriculum from the lesson pool.
    await ensureCurriculaForChild(child.id, body.learningLanguages, level, body.age);
  }

  return c.json(child, 201);
});

// DELETE /children/:id — full data erase (COPPA / GDPR-K)
// Cascades through children → lesson_progress → conversations → curricula → generated_weeks
childrenRoute.delete('/:id', async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const childId = c.req.param('id');
  const db = getDb();

  // Verify ownership before deleting
  const [child] = await db
    .select({ userId: children.userId })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);

  if (!child) return c.json({ error: 'child_not_found' }, 404);
  if (child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  // conversations FK is ON DELETE SET NULL — explicitly delete the child's
  // transcripts first so spoken речь isn't orphaned-but-retained (privacy promise).
  // (lesson_progress, child_memory, memory_threads, curricula, weeks cascade.)
  await db.delete(conversations).where(eq(conversations.childId, childId));
  await db.delete(children).where(eq(children.id, childId));

  return c.json({ ok: true, deleted: childId });
});

// PUT /children/:id — update child profile (sync progress, schedule, etc.)
childrenRoute.put('/:id', zValidator('json', updateChildSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ ok: true });
  const userId = c.get('userId');
  const childId = c.req.param('id');
  const body = c.req.valid('json');
  const db = getDb();

  const [updated] = await db
    .update(children)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(children.id, childId))
    .returning();

  if (!updated || updated.userId !== userId) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(updated);
});

// POST /children/:id/preferences — the post-week CHECKPOINT steering action.
// The parent adjusts interests and/or dials (more talk / more words / pacing);
// we save them, drop the personalized copy of all FUTURE lessons so they re-skin
// under the new settings (past/current lessons are never rewritten), and kick off
// re-skinning of the next week so it's ready by the time the child gets there.
const preferencesSchema = z
  .object({
    interests: z.array(z.string().max(40)).max(12).optional(),
    lessonPrefs: lessonPrefsSchema.optional(),
  })
  .refine((b) => b.interests !== undefined || b.lessonPrefs !== undefined, {
    message: 'nothing_to_update',
  });

childrenRoute.post('/:id/preferences', zValidator('json', preferencesSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const userId = c.get('userId');
  const childId = c.req.param('id');
  const body = c.req.valid('json');
  const db = getDb();

  // Verify ownership + get current progress / languages
  const [child] = await db
    .select()
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);
  if (child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.interests !== undefined) patch.interests = body.interests;
  if (body.lessonPrefs !== undefined) patch.lessonPrefs = body.lessonPrefs;

  const [updated] = await db
    .update(children)
    .set(patch)
    .where(eq(children.id, childId))
    .returning();

  // Re-tune only what's ahead — never rewrite a lesson the child has already seen.
  const fromDay = child.currentDay + 1;
  if (needsGeneratedCurriculum(child.level, child.ageBand)) {
    // Leveled / teen / adult: regenerate the upcoming AI weeks with the new prefs.
    await regenerateGeneratedCurriculumFrom(childId, child.learningLanguages, fromDay);
  } else {
    await invalidateLessonsFrom(childId, fromDay);
    // Await the primary language's next week so the change is visible the moment the
    // app refetches (the client shows a short "updating lessons" state meanwhile).
    // Other languages warm in the background.
    const [primary, ...rest] = child.learningLanguages;
    if (primary) await personalizeWeek(childId, primary, fromDay, fromDay + 6);
    for (const lang of rest) {
      void personalizeWeek(childId, lang, fromDay, fromDay + 6).catch(() => {});
    }
  }

  return c.json({ ok: true, child: updated, reskinFrom: fromDay });
});
