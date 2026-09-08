import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import { getDb } from '../db/client.js';
import { childCurricula, lessonTemplates } from '../db/schema.js';

/**
 * Pick the best template per day from a flat list of candidates.
 * Templates with higher qualityScore win; ties broken randomly.
 */
function pickPerDay(
  rows: { id: string; daySlot: number; qualityScore: number }[],
  days: number[],
): Map<number, string> {
  const groups = new Map<number, { id: string; quality: number }[]>();
  for (const r of rows) {
    if (!days.includes(r.daySlot)) continue;
    const arr = groups.get(r.daySlot) ?? [];
    arr.push({ id: r.id, quality: r.qualityScore });
    groups.set(r.daySlot, arr);
  }
  const result = new Map<number, string>();
  for (const [day, arr] of groups) {
    // Top quality first; among ties pick randomly
    arr.sort((a, b) => b.quality - a.quality);
    const top = arr[0]!;
    const tieGroup = arr.filter((c) => c.quality === top.quality);
    const pick = tieGroup[Math.floor(Math.random() * tieGroup.length)]!;
    result.set(day, pick.id);
  }
  return result;
}

/**
 * Assemble a 30-day curriculum for a newly registered child.
 * Bulk-fetches candidates across all days with cascading fallback levels,
 * then performs ONE batched insert.  Was up to 120 sequential DB round-trips
 * per language; now ~3.
 */
export async function assembleCurriculum(
  childId: string,
  language: string,
  level: string,
  age: number,
): Promise<void> {
  const db = getDb();
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const assigned = new Map<number, string>();

  // Pass 1 — exact match: language + level + age in range
  const pass1 = await db
    .select({
      id: lessonTemplates.id,
      daySlot: lessonTemplates.daySlot,
      qualityScore: lessonTemplates.qualityScore,
    })
    .from(lessonTemplates)
    .where(
      and(
        eq(lessonTemplates.language, language),
        eq(lessonTemplates.level, level),
        lte(lessonTemplates.ageMin, age),
        gte(lessonTemplates.ageMax, age),
      ),
    );
  for (const [day, id] of pickPerDay(pass1, days)) assigned.set(day, id);

  // Pass 2 — fallback: same level any age (only for days still missing)
  let missing = days.filter((d) => !assigned.has(d));
  if (missing.length > 0) {
    const pass2 = await db
      .select({
        id: lessonTemplates.id,
        daySlot: lessonTemplates.daySlot,
        qualityScore: lessonTemplates.qualityScore,
      })
      .from(lessonTemplates)
      .where(
        and(
          eq(lessonTemplates.language, language),
          eq(lessonTemplates.level, level),
          inArray(lessonTemplates.daySlot, missing),
        ),
      );
    for (const [day, id] of pickPerDay(pass2, missing)) assigned.set(day, id);
  }

  // Pass 3 — final fallback: beginner level
  missing = days.filter((d) => !assigned.has(d));
  if (missing.length > 0 && level !== 'beginner') {
    const pass3 = await db
      .select({
        id: lessonTemplates.id,
        daySlot: lessonTemplates.daySlot,
        qualityScore: lessonTemplates.qualityScore,
      })
      .from(lessonTemplates)
      .where(
        and(
          eq(lessonTemplates.language, language),
          eq(lessonTemplates.level, 'beginner'),
          inArray(lessonTemplates.daySlot, missing),
        ),
      );
    for (const [day, id] of pickPerDay(pass3, missing)) assigned.set(day, id);
  }

  // Single batched INSERT for all assigned days
  if (assigned.size > 0) {
    const rows = Array.from(assigned.entries()).map(([day, templateId]) => ({
      childId,
      language,
      day,
      templateId,
    }));
    await db
      .insert(childCurricula)
      .values(rows)
      .onConflictDoNothing();
  }
}

/**
 * Re-runs assembly for every language the child is learning.
 * Runs all languages in parallel to keep the request fast.
 */
export async function ensureCurriculaForChild(
  childId: string,
  languages: string[],
  level: string,
  age: number,
): Promise<void> {
  await Promise.all(
    languages.map((lang) => assembleCurriculum(childId, lang, level, age)),
  );
}
