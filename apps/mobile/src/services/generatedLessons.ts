import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './api';

export interface GeneratedGrammarExercise {
  kind: 'fill_blank' | 'order_words';
  prompt: string;
  options: string[];
  correct: string | string[];
}

export interface GeneratedLesson {
  day: number;
  theme: string;
  themeEmoji: string;
  vocabulary: string[];
  story: { text: string; emoji: string }[];
  wordGame: { emoji: string; correct: string; options: string[] }[];
  grammar: GeneratedGrammarExercise[];
  talkSystemPrompt: string;
  reward: { stars: number; message: string };
  reasoning: string;
}

const STORAGE_KEY = 'generated-lessons-v1';

// In-memory cache for sync access — keyed `${childId}-${lang}-${day}`
const memCache: Record<string, GeneratedLesson> = {};
let hydrated = false;

function cacheKey(childId: string, lang: string, day: number): string {
  return `${childId}-${lang}-${day}`;
}

export async function hydrateLessonCache(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
  } catch {
    // ignore corrupt cache
  }
  hydrated = true;
}

async function persistCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memCache));
  } catch {
    // disk full — non-fatal
  }
}

export function getCachedLesson(
  childId: string,
  lang: string,
  day: number,
): GeneratedLesson | null {
  return memCache[cacheKey(childId, lang, day)] ?? null;
}

export async function fetchLesson(
  childId: string,
  day: number,
  lang: string,
  token: string,
): Promise<GeneratedLesson | null> {
  const res = await fetch(
    `${API_BASE_URL}/lessons/generated/${childId}/${day}?language=${lang}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { lesson: GeneratedLesson };
  if (!json.lesson) return null;
  memCache[cacheKey(childId, lang, day)] = json.lesson;
  await persistCache();
  return json.lesson;
}

/** Ensures the 7 days starting at `weekStart` are cached locally. */
export async function ensureWeekCached(
  childId: string,
  lang: string,
  weekStart: number,
  token: string,
): Promise<{ ready: number; missing: number }> {
  let ready = 0;
  let missing = 0;
  for (let d = weekStart; d < weekStart + 7; d++) {
    if (getCachedLesson(childId, lang, d)) {
      ready += 1;
      continue;
    }
    const lesson = await fetchLesson(childId, d, lang, token).catch(() => null);
    if (lesson) ready += 1;
    else missing += 1;
  }
  return { ready, missing };
}

/** Returns the start day of the week containing `day` (for days >= 31). */
export function weekStartFor(day: number): number {
  if (day <= 30) return 1;
  return Math.floor((day - 31) / 7) * 7 + 31;
}

/** Triggers backend generation for the current/next week. */
export async function triggerWeekGeneration(
  childId: string,
  lang: string,
  token: string,
): Promise<{ ok: boolean; alreadyGenerated?: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/lessons/generate-week`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ childId, language: lang }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${body}` };
    }
    const json = (await res.json()) as { alreadyGenerated?: boolean };
    return { ok: true, alreadyGenerated: json.alreadyGenerated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** All cached weeks for a child — for parent UI. */
export interface GeneratedWeekRecord {
  id: string;
  childId: string;
  language: string;
  weekNumber: number;
  startDay: number;
  endDay: number;
  lessons: GeneratedLesson[];
  weekRationale: string;
  status: 'pending' | 'approved' | 'rejected';
  generatedAt: string;
}

export async function listWeeks(
  childId: string,
  lang: string,
  token: string,
): Promise<GeneratedWeekRecord[]> {
  const res = await fetch(`${API_BASE_URL}/lessons/weeks/${childId}?language=${lang}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as GeneratedWeekRecord[];
}

export async function approveWeek(weekId: string, token: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/lessons/weeks/${weekId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
