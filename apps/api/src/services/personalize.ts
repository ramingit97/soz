/**
 * LEGACY — interest-skinning of the static bundled days 1-30 (Phase 25).
 *
 * SUPERSEDED by services/generatedCurriculum.ts. Since needsGeneratedCurriculum()
 * is now unconditionally true, none of these functions run for a real child; the
 * child_curricula table is never written for new children and reads return empty.
 * Kept as a RETAINED FALLBACK for offline/static serving if generation is ever
 * disabled. Do not extend this module — put new curriculum logic in
 * generatedCurriculum.ts. Physical-removal checklist: context/CLEANUP-personalize-legacy.md
 */
import { and, eq, gte } from 'drizzle-orm';

import { skinLesson, type SkinDirectives } from '../ai/skin.js';
import { getDb, isDbAvailable } from '../db/client.js';
import {
  childCurricula,
  children,
  lessonTemplates,
  type LessonContent,
} from '../db/schema.js';

// Everything needed to skin a lesson for one child — loaded once, reused per day.
interface ChildSkinCtx {
  interests: string[];
  name: string;
  isAdult: boolean;
  prefs?: SkinDirectives; // parent dials (children.lessonPrefs)
}

async function loadChildCtx(childId: string): Promise<ChildSkinCtx | null> {
  const db = getDb();
  const [row] = await db
    .select({
      interests: children.interests,
      name: children.name,
      profileType: children.profileType,
      lessonPrefs: children.lessonPrefs,
    })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);
  if (!row) return null;
  return {
    interests: row.interests ?? [],
    name: row.name,
    isAdult: row.profileType === 'adult',
    prefs: row.lessonPrefs ?? undefined,
  };
}

function canSkin(ctx: ChildSkinCtx | null, language: string): ctx is ChildSkinCtx {
  return (
    !!ctx &&
    !ctx.isAdult &&
    ctx.interests.length > 0 &&
    (language === 'en' || language === 'ru')
  );
}

// Core: skin one day given an already-loaded child context. Returns the content
// to SERVE — personalized if we could make it, otherwise the untouched template.
// A failed skin is swallowed: a bad LLM call must never break a lesson.
async function skinDayWithCtx(
  childId: string,
  language: string,
  day: number,
  ctx: ChildSkinCtx | null,
  directives?: SkinDirectives,
): Promise<LessonContent | null> {
  const db = getDb();
  const [row] = await db
    .select({
      content: childCurricula.content,
      templateContent: lessonTemplates.content,
    })
    .from(childCurricula)
    .innerJoin(lessonTemplates, eq(childCurricula.templateId, lessonTemplates.id))
    .where(
      and(
        eq(childCurricula.childId, childId),
        eq(childCurricula.language, language),
        eq(childCurricula.day, day),
      ),
    )
    .limit(1);

  if (!row) return null; // day not assigned
  if (row.content) return row.content; // already personalized — serve as is

  const tpl = row.templateContent;
  if (!canSkin(ctx, language)) return tpl; // nothing to personalize with → template

  try {
    const skinned = await skinLesson({
      base: tpl,
      interests: ctx.interests,
      language: language as 'en' | 'ru',
      childName: ctx.name,
      directives: directives ?? ctx.prefs, // explicit override, else stored parent dials
    });
    await db
      .update(childCurricula)
      .set({ content: skinned, personalizedAt: new Date() })
      .where(
        and(
          eq(childCurricula.childId, childId),
          eq(childCurricula.language, language),
          eq(childCurricula.day, day),
        ),
      );
    return skinned;
  } catch {
    return tpl; // graceful fallback — never block on a skin failure
  }
}

/**
 * Drop the personalized copy of every day from `fromDay` onward (all languages),
 * so they get re-skinned under freshly-changed interests / parent dials. Past and
 * current lessons are left intact — we never rewrite a lesson the child already saw.
 * Returns nothing; the actual re-skin happens lazily on next fetch (or kick a week).
 */
export async function invalidateLessonsFrom(childId: string, fromDay: number): Promise<void> {
  if (!isDbAvailable()) return;
  const db = getDb();
  await db
    .update(childCurricula)
    .set({ content: null, personalizedAt: null })
    .where(and(eq(childCurricula.childId, childId), gte(childCurricula.day, fromDay)));
}

/** Personalize a single day (loads the child context itself). */
export async function personalizeDay(
  childId: string,
  language: string,
  day: number,
  directives?: SkinDirectives,
): Promise<LessonContent | null> {
  if (!isDbAvailable()) return null;
  const ctx = await loadChildCtx(childId);
  return skinDayWithCtx(childId, language, day, ctx, directives);
}

/**
 * Personalize a range of days (e.g. one "week"). Loads the child context once,
 * skins each day in parallel. Per-day failures are isolated. Safe to fire-and-
 * forget for later weeks, or await for the first week so it's ready on first open.
 */
export async function personalizeWeek(
  childId: string,
  language: string,
  startDay: number,
  endDay: number,
  directives?: SkinDirectives,
): Promise<void> {
  if (!isDbAvailable()) return;
  const ctx = await loadChildCtx(childId);
  if (!canSkin(ctx, language)) return; // skip the whole pass cheaply (no interests / adult)

  const days: number[] = [];
  for (let d = startDay; d <= endDay; d++) days.push(d);
  await Promise.all(
    days.map((d) => skinDayWithCtx(childId, language, d, ctx, directives).catch(() => null)),
  );
}
