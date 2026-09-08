import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LessonData } from '@/data/lessons';

import { API_BASE_URL } from './api';

const STORAGE_KEY = 'curriculum-v1';

// In-memory cache for sync access — keyed `${childId}-${lang}-${day}`
const memCache: Record<string, LessonData> = {};
let hydrated = false;

function key(childId: string, lang: string, day: number): string {
  return `${childId}-${lang}-${day}`;
}

export async function hydrateCurriculumCache(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(memCache, JSON.parse(raw));
  } catch {
    // ignore
  }
  hydrated = true;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memCache));
  } catch {
    // ignore
  }
}

export function getCachedCurriculumLesson(
  childId: string,
  lang: string,
  day: number,
): LessonData | null {
  return memCache[key(childId, lang, day)] ?? null;
}

interface CurriculumResponse {
  day: number;
  language: string;
  content: LessonData;
}

interface CurriculumBatchResponse {
  language: string;
  lessons: { day: number; content: LessonData }[];
}

export async function fetchCurriculumLesson(
  childId: string,
  day: number,
  lang: string,
  token: string,
): Promise<LessonData | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/lessons/curriculum/${childId}/${day}?language=${lang}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as CurriculumResponse;
    if (!json.content) return null;
    memCache[key(childId, lang, day)] = json.content;
    await persist();
    return json.content;
  } catch {
    return null;
  }
}

/** Pre-fetch the entire 30-day curriculum into the local cache. */
export async function fetchFullCurriculum(
  childId: string,
  lang: string,
  token: string,
): Promise<number> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/lessons/curriculum/${childId}?language=${lang}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as CurriculumBatchResponse;
    for (const entry of json.lessons) {
      memCache[key(childId, lang, entry.day)] = entry.content;
    }
    await persist();
    return json.lessons.length;
  } catch {
    return 0;
  }
}
