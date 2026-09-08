import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { getLesson } from '@soz/content';
import { LANGUAGE_CODES, LEVELS } from '@soz/shared-types';

import { runAnalysis, type AnalysisInput } from '../ai/analysis.js';
import {
  GENERATOR_MODEL,
  currentSeason,
  generateWeekPlan,
  type GeneratorInput,
} from '../ai/generator.js';
import { requirePaidDay, requirePremium } from '../auth/entitlement.js';
import { requireAuth } from '../auth/middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getDb, isDbAvailable } from '../db/client.js';
import {
  childCurricula,
  children,
  conversations,
  generatedWeeks,
  lessonProgress,
  lessonTemplates,
} from '../db/schema.js';
import { ensureCurriculaForChild } from '../services/curriculum.js';
import {
  getGeneratedCurriculumAll,
  getGeneratedCurriculumDay,
  needsGeneratedCurriculum,
} from '../services/generatedCurriculum.js';
import { personalizeDay, personalizeWeek } from '../services/personalize.js';

export const lessonRoute = new Hono();

const lessonQuerySchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  level: z.enum(LEVELS),
  day: z.coerce.number().int().min(1).max(120),
});

lessonRoute.get('/today', zValidator('query', lessonQuerySchema), (c) => {
  const { language, level, day } = c.req.valid('query');
  const lesson = getLesson(language, level, day);
  if (!lesson) {
    return c.json({ error: 'lesson_not_found', language, level, day }, 404);
  }
  return c.json(lesson);
});

// ── AI-generated personalized weeks (days 31+) — auth required ───────────────

const aiLessonRoute = new Hono();
aiLessonRoute.use('*', requireAuth);

const generateBodySchema = z.object({
  childId: z.string().uuid(),
  language: z.enum(['en', 'ru']),
});

// Generation is the second most expensive endpoint (~$0.05-0.10/week).
// Limit to 5 generations per user per hour to prevent runaway costs.
aiLessonRoute.use(
  '/generate-week',
  rateLimit({ name: 'generate_week', capacity: 5, windowMs: 60 * 60 * 1000 }),
);
// Generated weeks only exist from day 31 on — far past the 7 free days the store
// page advertises — so this is subscribers-only. It was previously reachable by
// any signed-in account and is the single most expensive call in the product.
aiLessonRoute.use('/generate-week', requirePremium);

// POST /lessons/generate-week — generates next personalized week for a child
aiLessonRoute.post('/generate-week', zValidator('json', generateBodySchema), async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const { childId, language } = c.req.valid('json');
  const db = getDb();

  // 1. Verify ownership
  const [child] = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);

  // 2. Determine which week to generate (next one after currentDay)
  const currentDay = child.currentDay;
  const startDay = Math.max(31, currentDay <= 30 ? 31 : Math.floor((currentDay - 31) / 7) * 7 + 31);
  const endDay = startDay + 6;
  const weekNumber = Math.floor((startDay - 31) / 7) + 5; // weeks 1-4 = days 1-30 (static), week 5+ = generated

  // 3. Skip if already generated
  const [existing] = await db
    .select()
    .from(generatedWeeks)
    .where(
      and(
        eq(generatedWeeks.childId, childId),
        eq(generatedWeeks.language, language),
        eq(generatedWeeks.weekNumber, weekNumber),
      ),
    )
    .limit(1);

  if (existing) {
    return c.json({ ok: true, alreadyGenerated: true, week: existing });
  }

  // 4. Run analysis
  const progress = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.childId, childId), eq(lessonProgress.language, language)));

  const allErrors = progress.flatMap((p) => p.errors);
  const themesCovered = progress.map((p) => `day ${p.day}`);

  const convs = await db
    .select({ day: conversations.day, turns: conversations.turns })
    .from(conversations)
    .where(and(eq(conversations.childId, childId), eq(conversations.language, language)));

  const conversationTurns = convs.flatMap((cv) =>
    cv.turns.map((t) => ({ role: t.role, text: t.text, day: cv.day })),
  );

  const analysisInput: AnalysisInput = {
    childName: child.name,
    childAge: child.age,
    level: child.level,
    language,
    lessonsCompleted: progress.length,
    totalStars: child.totalStars,
    errors: allErrors,
    conversationTurns,
    themesCovered,
    profileInterests: child.interests ?? [],
  };

  const analysis = await runAnalysis(analysisInput);

  // Guarantee the family's stated interests reach the generator even if the
  // analyst under-weighted them (e.g. quiet child, few conversations yet).
  analysis.interests = Array.from(
    new Set([...(child.interests ?? []), ...analysis.interests]),
  ).slice(0, 8);

  // 5. Pull recent themes (last 4 weeks of generated content)
  const recentWeeks = await db
    .select()
    .from(generatedWeeks)
    .where(
      and(
        eq(generatedWeeks.childId, childId),
        eq(generatedWeeks.language, language),
        gte(generatedWeeks.weekNumber, weekNumber - 4),
        lte(generatedWeeks.weekNumber, weekNumber - 1),
      ),
    );
  const recentThemes = recentWeeks.flatMap((w) => w.lessons.map((l) => l.theme));

  // 6. Generate the plan
  const generatorInput: GeneratorInput = {
    childName: child.name,
    childAge: child.age,
    level: child.level,
    language,
    startDay,
    endDay,
    weekNumber,
    analysis,
    recentThemes,
    season: currentSeason(),
    prefs: child.lessonPrefs ?? undefined,
  };

  const plan = await generateWeekPlan(generatorInput);

  // 7. Store in DB
  const [stored] = await db
    .insert(generatedWeeks)
    .values({
      childId,
      language,
      weekNumber,
      startDay,
      endDay,
      lessons: plan.lessons,
      analysis,
      weekRationale: plan.weekRationale,
      status: 'pending',
      model: GENERATOR_MODEL,
    })
    .returning();

  return c.json({ ok: true, alreadyGenerated: false, week: stored });
});

// GET /lessons/generated/:childId/:day — fetch a single AI-generated lesson
aiLessonRoute.get('/generated/:childId/:day', async (c) => {
  const dayParam = Number(c.req.param('day'));
  // Free through FREE_DAYS, subscription beyond — the "7 дней бесплатно" promise,
  // enforced server-side. The client-only isPremium flag lives in AsyncStorage
  // and cannot be trusted to gate content that costs money to produce.
  const paywalled = await requirePaidDay(c, dayParam);
  if (paywalled) return paywalled;

  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const day = Number(c.req.param('day'));
  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const db = getDb();

  const [child] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);

  const [week] = await db
    .select()
    .from(generatedWeeks)
    .where(
      and(
        eq(generatedWeeks.childId, childId),
        eq(generatedWeeks.language, language),
        lte(generatedWeeks.startDay, day),
        gte(generatedWeeks.endDay, day),
      ),
    )
    .limit(1);

  if (!week) return c.json({ error: 'lesson_not_generated_yet' }, 404);

  const lesson = week.lessons.find((l) => l.day === day);
  if (!lesson) return c.json({ error: 'lesson_not_in_week' }, 404);

  return c.json({ lesson, weekStatus: week.status, weekRationale: week.weekRationale });
});

// GET /lessons/weeks/:childId — list all generated weeks for a child
aiLessonRoute.get('/weeks/:childId', async (c) => {
  if (!isDbAvailable()) return c.json([]);

  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const db = getDb();

  const [child] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);

  const weeks = await db
    .select()
    .from(generatedWeeks)
    .where(and(eq(generatedWeeks.childId, childId), eq(generatedWeeks.language, language)))
    .orderBy(desc(generatedWeeks.weekNumber));

  return c.json(weeks);
});

// POST /lessons/weeks/:weekId/approve — parent approves a generated week
aiLessonRoute.post('/weeks/:weekId/approve', async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const weekId = c.req.param('weekId');
  const db = getDb();

  const [week] = await db.select().from(generatedWeeks).where(eq(generatedWeeks.id, weekId)).limit(1);
  if (!week) return c.json({ error: 'week_not_found' }, 404);

  // Verify ownership via child
  const [child] = await db
    .select({ userId: children.userId })
    .from(children)
    .where(eq(children.id, week.childId))
    .limit(1);
  if (!child || child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  const [updated] = await db
    .update(generatedWeeks)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(generatedWeeks.id, weekId))
    .returning();

  return c.json({ ok: true, week: updated });
});

// ── Static curriculum (days 1-30) ────────────────────────────────────────────

// GET /lessons/curriculum/:childId/:day — fetch a single curriculum lesson
aiLessonRoute.get('/curriculum/:childId/:day', async (c) => {
  const dayParam = Number(c.req.param('day'));
  // Free through FREE_DAYS, subscription beyond — the "7 дней бесплатно" promise,
  // enforced server-side. The client-only isPremium flag lives in AsyncStorage
  // and cannot be trusted to gate content that costs money to produce.
  const paywalled = await requirePaidDay(c, dayParam);
  if (paywalled) return paywalled;

  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const day = Number(c.req.param('day'));
  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const db = getDb();

  // Verify ownership
  const [child] = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);

  // Leveled / teen / adult learners are served an AI-generated, age-appropriate
  // curriculum instead of the beginner-only static pool.
  if (needsGeneratedCurriculum(child.level, child.ageBand)) {
    const genContent = await getGeneratedCurriculumDay(childId, language, day);
    if (!genContent) return c.json({ error: 'lesson_not_generated_yet' }, 404);
    return c.json({ day, language, content: genContent });
  }

  // Fetch curriculum entry — auto-assemble if missing (handles old children)
  let [curr] = await db
    .select()
    .from(childCurricula)
    .where(
      and(
        eq(childCurricula.childId, childId),
        eq(childCurricula.language, language),
        eq(childCurricula.day, day),
      ),
    )
    .limit(1);

  if (!curr) {
    // Backfill curriculum for this child+language
    await ensureCurriculaForChild(childId, [language], child.level, child.age);
    [curr] = await db
      .select()
      .from(childCurricula)
      .where(
        and(
          eq(childCurricula.childId, childId),
          eq(childCurricula.language, language),
          eq(childCurricula.day, day),
        ),
      )
      .limit(1);
  }

  if (!curr) return c.json({ error: 'lesson_not_assigned' }, 404);

  // Serve the child's personalized ("interest-skinned") version. personalizeDay
  // skins lazily on first read and caches it; it falls back to the shared template
  // content when there's nothing to personalize with (no interests / adult profile).
  const content = await personalizeDay(childId, language, day);
  if (!content) return c.json({ error: 'template_missing' }, 404);

  return c.json({ day, language, content });
});

// GET /lessons/curriculum/:childId — full curriculum (all 30 days, batch fetch)
aiLessonRoute.get('/curriculum/:childId', async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const db = getDb();

  const [child] = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);

  // Leveled / teen / adult learners: serve their AI-generated curriculum (week 1
  // ready immediately, weeks 2-5 fill in the background).
  if (needsGeneratedCurriculum(child.level, child.ageBand)) {
    const lessons = await getGeneratedCurriculumAll(childId, language);
    return c.json({ language, lessons });
  }

  // Select both the per-child personalized content (if skinned) and the shared
  // template content (fallback). We coalesce per day so unskinned days still work.
  const selectEntries = () =>
    db
      .select({
        day: childCurricula.day,
        personal: childCurricula.content,
        template: lessonTemplates.content,
      })
      .from(childCurricula)
      .innerJoin(lessonTemplates, eq(childCurricula.templateId, lessonTemplates.id))
      .where(
        and(
          eq(childCurricula.childId, childId),
          eq(childCurricula.language, language),
        ),
      )
      .orderBy(childCurricula.day);

  let rows = await selectEntries();
  if (rows.length === 0) {
    await ensureCurriculaForChild(childId, [language], child.level, child.age);
    rows = await selectEntries();
  }

  // Personalize WEEK 1 up-front (await): the first lessons are what decide whether
  // a child stays, so they must already feel made-for-them on first open. This is
  // a no-op (returns instantly) when the child has no interests or is an adult, and
  // skips any day already skinned — so it only costs AI on the very first fetch.
  await personalizeWeek(childId, language, 1, 7);
  // Skin the rest in the background so weeks 2-4 are ready by the time the child
  // reaches them (picked up on the next curriculum fetch / app open).
  void personalizeWeek(childId, language, 8, 30).catch(() => {});

  rows = await selectEntries();
  const lessons = rows.map((r) => ({ day: r.day, content: r.personal ?? r.template }));
  return c.json({ language, lessons });
});

// Mount the AI sub-router under the same prefix
lessonRoute.route('/', aiLessonRoute);
