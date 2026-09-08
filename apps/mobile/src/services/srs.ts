/**
 * Tiny client-side spaced-repetition store for saved phrases (Leitner boxes).
 *
 * Kept on-device (AsyncStorage, per child) for now — no server table. Good
 * enough for "save the phrases I learned and review them later"; can be
 * server-backed later for cross-device sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SrsCard {
  id: string;
  text: string;
  translation: string;
  lang: string;
  box: number; // Leitner box 0..5
  dueAt: number; // epoch ms
  createdAt: number;
}

const KEY = (childId: string) => `srs:${childId}`;
// Box → next interval (ms): 10 min, 1d, 3d, 7d, 16d, 35d
const INTERVALS = [10 * 60_000, 86_400_000, 3 * 86_400_000, 7 * 86_400_000, 16 * 86_400_000, 35 * 86_400_000];

async function load(childId: string): Promise<SrsCard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY(childId));
    return raw ? (JSON.parse(raw) as SrsCard[]) : [];
  } catch {
    return [];
  }
}

async function persist(childId: string, cards: SrsCard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(childId), JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

/** Add new phrases (dedup by text). Returns how many were newly added. */
export async function savePhrases(
  childId: string,
  phrases: { text: string; translation: string }[],
  lang: string,
): Promise<number> {
  const cards = await load(childId);
  const seen = new Set(cards.map((c) => c.text.toLowerCase().trim()));
  const now = Date.now();
  let added = 0;
  for (const p of phrases) {
    const key = p.text.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cards.push({
      id: `${now}-${added}`,
      text: p.text,
      translation: p.translation,
      lang,
      box: 0,
      dueAt: now,
      createdAt: now,
    });
    added++;
  }
  if (added > 0) await persist(childId, cards);
  return added;
}

export async function getDuePhrases(childId: string): Promise<SrsCard[]> {
  const cards = await load(childId);
  const now = Date.now();
  return cards.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
}

export async function totalPhrases(childId: string): Promise<number> {
  return (await load(childId)).length;
}

/** Grade a review: known → advance a box (longer interval); else reset to box 0. */
export async function gradePhrase(childId: string, id: string, known: boolean): Promise<void> {
  const cards = await load(childId);
  const card = cards.find((c) => c.id === id);
  if (!card) return;
  card.box = known ? Math.min(card.box + 1, INTERVALS.length - 1) : 0;
  card.dueAt = Date.now() + (INTERVALS[card.box] ?? INTERVALS[0]!);
  await persist(childId, cards);
}
