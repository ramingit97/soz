/**
 * One-time seed script that loads the static 30-day curriculum + grammar
 * exercises from the mobile app into the lesson_templates pool.
 *
 * Usage:
 *   pnpm --filter api exec tsx src/db/seed-pool.ts
 *
 * Idempotent: re-running will only insert (language, level, day_slot) rows
 * that don't yet exist.
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';

import { getDb, isDbAvailable } from './client.js';
import { lessonTemplates, type LessonContent } from './schema.js';

// Mobile-side data files have NO React Native imports — pure data, safe to load via tsx.
// Use dynamic import so NodeNext doesn't choke on .ts extensions in static imports.
async function loadMobileData() {
  const lessons = await import('../../../mobile/src/data/lessons.ts' as string);
  const grammar = await import('../../../mobile/src/data/grammar.ts' as string);
  return { LESSONS: lessons.LESSONS, STATIC_GRAMMAR: grammar.STATIC_GRAMMAR };
}

interface MobileLessonData {
  theme: string;
  themeEmoji: string;
  vocabulary: string[];
  story: { text: string; emoji: string }[];
  wordGame: { emoji: string; correct: string; options: string[] }[];
  talkSystemPrompt: string;
  reward: { stars: number; message: string };
}

interface MobileGrammarExercise {
  kind: 'fill_blank' | 'order_words';
  prompt: string;
  options: string[];
  correct: string | string[];
}

const TARGET_LEVEL = 'beginner';
const AGE_MIN = 8;
const AGE_MAX = 12;

async function seed() {
  if (!isDbAvailable()) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const db = getDb();

  const { LESSONS, STATIC_GRAMMAR } = await loadMobileData();
  const lessonsByLang: Record<string, Record<number, MobileLessonData>> = LESSONS;
  const grammarByLang: Record<string, Record<number, MobileGrammarExercise[]>> = STATIC_GRAMMAR;

  let inserted = 0;
  let skipped = 0;

  for (const language of ['en', 'ru'] as const) {
    const lessons = lessonsByLang[language] ?? {};
    const grammars = grammarByLang[language] ?? {};

    for (const [dayStr, lessonData] of Object.entries(lessons)) {
      const day = Number(dayStr);

      // Skip if already in pool for this (language, level, day_slot, source='manual')
      const [existing] = await db
        .select({ id: lessonTemplates.id })
        .from(lessonTemplates)
        .where(
          and(
            eq(lessonTemplates.language, language),
            eq(lessonTemplates.level, TARGET_LEVEL),
            eq(lessonTemplates.daySlot, day),
            eq(lessonTemplates.source, 'manual'),
          ),
        )
        .limit(1);

      if (existing) {
        skipped += 1;
        continue;
      }

      const grammar = grammars[day] ?? [];

      const content: LessonContent = {
        theme: lessonData.theme,
        themeEmoji: lessonData.themeEmoji,
        vocabulary: lessonData.vocabulary,
        story: lessonData.story,
        wordGame: lessonData.wordGame,
        grammar,
        talkSystemPrompt: lessonData.talkSystemPrompt,
        reward: lessonData.reward,
      };

      await db.insert(lessonTemplates).values({
        language,
        level: TARGET_LEVEL,
        ageMin: AGE_MIN,
        ageMax: AGE_MAX,
        daySlot: day,
        content,
        source: 'manual',
        qualityScore: 100,
      });

      inserted += 1;
    }
  }

  console.log(`✅ Seed complete. Inserted ${inserted} templates, skipped ${skipped} existing.`);
  process.exit(0);
}

seed().catch((e) => {
  console.error('seed failed:', e);
  process.exit(1);
});
