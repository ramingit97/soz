import { and, eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { localDateISO, nextStreak } from '@soz/shared-types';

import { requireAuth } from '../auth/middleware.js';
import { requireChild } from '../auth/ownership.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { children, lessonProgress } from '../db/schema.js';

export const progressRoute = new Hono();

progressRoute.use('*', requireAuth);

const errorSchema = z.object({
  kind: z.enum(['word_game', 'grammar', 'pronunciation']),
  prompt: z.string().max(500),
  correct: z.string().max(500),
  given: z.string().max(500),
});

const completeSchema = z.object({
  childId: z.string().uuid(),
  language: z.string().min(2).max(5),
  day: z.number().int().min(1).max(120),
  starsEarned: z.number().int().min(0).max(100),
  errors: z.array(errorSchema).max(50).default([]),
  // Minutes to add to UTC for the learner's local time (Baku = 240). Streaks are
  // a local-calendar notion; without this they break for anyone practising in the
  // evening. Optional so older clients keep working (they fall back to UTC).
  tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});

// POST /progress — record a completed lesson and update child totals.
//
// Idempotent by (childId, language, day): replaying the same completion must not
// re-award stars or advance the day again. The insert was already idempotent via
// the unique constraint, but the totals update ran unconditionally — so returning
// to the completion screen farmed stars and skipped a day. The insert's RETURNING
// is now the gate: no row back = already recorded = nothing left to do.
progressRoute.post('/', zValidator('json', completeSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ ok: true, skipped: true });

  const { childId, language, day, starsEarned, errors, tzOffsetMinutes } = c.req.valid('json');

  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const db = getDb();

  const inserted = await db
    .insert(lessonProgress)
    .values({ childId, language, day, starsEarned, errors })
    .onConflictDoNothing()
    .returning({ id: lessonProgress.id });

  const [child] = await db
    .select({
      streak: children.streak,
      lastCompletedDate: children.lastCompletedDate,
      totalStars: children.totalStars,
      currentDay: children.currentDay,
    })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);

  if (!child) return c.json({ error: 'child_not_found' }, 404);

  // Replay of a day already recorded — report current state, change nothing.
  if (inserted.length === 0) {
    return c.json({
      ok: true,
      duplicate: true,
      totalStars: child.totalStars,
      streak: child.streak,
      currentDay: child.currentDay,
    });
  }

  const today = localDateISO(tzOffsetMinutes);
  const streak = nextStreak(child.streak, child.lastCompletedDate, tzOffsetMinutes);
  // Never walk the child backwards: replaying an earlier day (day 3 while on day
  // 10) used to set currentDay to 4 and wipe a week of progress on next hydrate.
  const currentDay = Math.max(child.currentDay, Math.min(day + 1, 120));

  await db
    .update(children)
    .set({
      totalStars: child.totalStars + starsEarned,
      lastCompletedDate: today,
      streak,
      currentDay,
      updatedAt: new Date(),
    })
    .where(eq(children.id, childId));

  // The client mirrors these locally; returning them lets it converge on the
  // server's numbers instead of computing its own and losing the disagreement.
  return c.json({
    ok: true,
    totalStars: child.totalStars + starsEarned,
    streak,
    currentDay,
  });
});

// GET /progress/:childId — all completed lessons for a child
progressRoute.get('/:childId', async (c) => {
  if (!isDbAvailable()) return c.json([]);

  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const db = getDb();

  const rows = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.childId, childId))
    .orderBy(lessonProgress.completedAt);

  return c.json(rows);
});

// GET /progress/:childId/errors — aggregate review queue (deduped, recent first)
progressRoute.get('/:childId/errors', async (c) => {
  if (!isDbAvailable()) return c.json({ items: [] });

  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const language = c.req.query('language');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '15', 10), 50);
  const db = getDb();

  const rows = await db
    .select()
    .from(lessonProgress)
    .where(
      language
        ? and(eq(lessonProgress.childId, childId), eq(lessonProgress.language, language))
        : eq(lessonProgress.childId, childId),
    )
    .orderBy(lessonProgress.completedAt);

  // Flatten + dedupe by `correct` word, recent first
  const seen = new Set<string>();
  const items: Array<{ kind: string; prompt: string; correct: string; given: string; day: number; date: string }> = [];

  // Iterate newest → oldest
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) continue;
    const errs = (row.errors ?? []) as Array<{ kind: string; prompt: string; correct: string; given: string }>;
    for (const err of errs) {
      const key = err.correct.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        kind: err.kind,
        prompt: err.prompt,
        correct: err.correct,
        given: err.given,
        day: row.day,
        date: row.completedAt instanceof Date ? row.completedAt.toISOString() : String(row.completedAt),
      });
      if (items.length >= limit) break;
    }
    if (items.length >= limit) break;
  }

  return c.json({ items });
});
