/**
 * Local persistence of the last talk conversation, per child + language.
 *
 * Why local: the server already remembers conversation *facts* (memory_threads)
 * and drives temporal callbacks, but the raw chat bubbles are cleared every time
 * the child re-enters /talk. Showing the previous conversation muted above the
 * live chat makes Хани's memory *visible* to the child — the app's headline
 * differentiator (see the market analysis). This is a display aid, not the
 * source of truth for memory.
 *
 * Never throws; a miss/guest returns an empty list.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredTurn {
  role: 'child' | 'bobo';
  text: string;
}

/** Keep the tail bounded — enough to feel remembered, small enough to be cheap. */
const MAX_TURNS = 12;

function keyFor(childId: string, lang: string): string {
  return `talk-history:${childId}:${lang}`;
}

// The trial runs on a real guest ACCOUNT now, so every childId is a genuine
// profile id — the old `guest-<timestamp>` placeholder no longer exists.
function isReal(childId: string | null): childId is string {
  return !!childId;
}

/** Load the previous conversation for this child+language ([] on miss/guest). */
export async function loadTalkHistory(
  childId: string | null,
  lang: string,
): Promise<StoredTurn[]> {
  if (!isReal(childId)) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(childId, lang));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredTurn[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.text === 'string' && (t.role === 'child' || t.role === 'bobo'))
      .slice(-MAX_TURNS);
  } catch {
    return [];
  }
}

/** Persist the current conversation tail (best-effort; skips guests/empty). */
export async function saveTalkHistory(
  childId: string | null,
  lang: string,
  turns: StoredTurn[],
): Promise<void> {
  if (!isReal(childId) || turns.length === 0) return;
  try {
    const tail = turns.slice(-MAX_TURNS).map((t) => ({ role: t.role, text: t.text }));
    await AsyncStorage.setItem(keyFor(childId, lang), JSON.stringify(tail));
  } catch {
    // best-effort only
  }
}
