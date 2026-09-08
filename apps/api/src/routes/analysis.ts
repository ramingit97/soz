import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { runAnalysis, type AnalysisInput } from '../ai/analysis.js';
import { requireAuth } from '../auth/middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { children, conversations, lessonProgress } from '../db/schema.js';

export const analysisRoute = new Hono();

analysisRoute.use('*', requireAuth);
// Analysis uses GPT-4o-mini — cheaper but still LLM. 10/hour per user.
analysisRoute.use('*', rateLimit({ name: 'analysis', capacity: 10, windowMs: 60 * 60 * 1000 }));

// GET /analysis/:childId — produces a pedagogical analysis of the child's progress
analysisRoute.get('/:childId', async (c) => {
  if (!isDbAvailable()) {
    return c.json({ error: 'database_not_configured' }, 503);
  }

  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const db = getDb();

  // 1. Verify child belongs to this parent
  const [child] = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);

  if (!child) return c.json({ error: 'child_not_found' }, 404);

  // 2. Pull progress + errors for the requested language
  const progress = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.childId, childId), eq(lessonProgress.language, language)));

  const allErrors = progress.flatMap((p) => p.errors);
  const themesCovered = progress.map((p) => `day ${p.day}`);

  // 3. Pull conversation turns from child
  const convs = await db
    .select({ day: conversations.day, turns: conversations.turns })
    .from(conversations)
    .where(and(eq(conversations.childId, childId), eq(conversations.language, language)));

  const conversationTurns = convs.flatMap((cv) =>
    cv.turns.map((t) => ({ role: t.role, text: t.text, day: cv.day })),
  );

  // 4. Build input + run GPT
  const input: AnalysisInput = {
    childName: child.name,
    childAge: child.age,
    level: child.level,
    language,
    lessonsCompleted: progress.length,
    totalStars: child.totalStars,
    errors: allErrors,
    conversationTurns,
    themesCovered,
  };

  // Edge case: nothing to analyze yet
  if (progress.length === 0) {
    return c.json({
      analysis: {
        strengths: [],
        weaknesses: [],
        vocabularyToReview: [],
        conversationTopics: [],
        interests: [],
        suggestedFocus: [],
      },
      meta: {
        lessonsCompleted: 0,
        totalStars: child.totalStars,
        totalErrors: 0,
        empty: true,
      },
    });
  }

  try {
    const analysis = await runAnalysis(input);
    return c.json({
      analysis,
      meta: {
        lessonsCompleted: progress.length,
        totalStars: child.totalStars,
        totalErrors: allErrors.length,
        empty: false,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'analysis_failed';
    return c.json({ error: msg }, 500);
  }
});
