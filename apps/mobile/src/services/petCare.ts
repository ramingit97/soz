/**
 * Pet-care persistence — keeps Хани's tamagotchi stats (hunger/love/energy)
 * between sessions so caring for the pet actually matters.
 *
 * Design notes:
 * - Stored per-child in AsyncStorage as { stats, ts } (ts = last-save epoch ms).
 * - On load we apply a GENTLE time-decay for the hours the child was away, but
 *   floor each stat at FLOOR so absence never greets the child with a "dead"
 *   pet (that would be guilt, which the whole app deliberately avoids —
 *   see the streak-softening work). Coming back should feel warm, not punishing.
 * - Never throws: a storage miss falls back to friendly defaults.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PetStats {
  hunger: number;
  love: number;
  energy: number;
}

/** A freshly-adopted (or storage-less) Хани starts content, not needy. */
export const DEFAULT_STATS: PetStats = { hunger: 72, love: 65, energy: 80 };

const MAX = 100;
/** How many points each stat sheds per hour away — soft, ~a day to feel hungry. */
const DECAY_PER_HOUR = 3;
/** Offline decay never drops a stat below this — absence shouldn't punish. */
const FLOOR = 25;

function keyFor(childId: string | null): string {
  return `pet-care:${childId ?? 'guest'}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(MAX, n));
}

/**
 * Load persisted stats and apply gentle away-decay. Returns DEFAULT_STATS on a
 * fresh child or any read error.
 */
export async function loadPetStats(childId: string | null): Promise<PetStats> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(childId));
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as { stats?: Partial<PetStats>; ts?: number };
    const stored: PetStats = {
      hunger: clamp(parsed.stats?.hunger ?? DEFAULT_STATS.hunger),
      love: clamp(parsed.stats?.love ?? DEFAULT_STATS.love),
      energy: clamp(parsed.stats?.energy ?? DEFAULT_STATS.energy),
    };
    const hoursAway = parsed.ts ? (Date.now() - parsed.ts) / 3_600_000 : 0;
    if (hoursAway <= 0) return stored;
    const drop = hoursAway * DECAY_PER_HOUR;
    // Decay toward FLOOR, never below it — a returning child sees a pet that
    // missed them, not one that starved.
    const decay = (v: number) => (v <= FLOOR ? v : Math.max(FLOOR, v - drop));
    return {
      hunger: decay(stored.hunger),
      love: decay(stored.love),
      energy: decay(stored.energy),
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

/** Persist current stats with a fresh timestamp. Best-effort; swallows errors. */
export async function savePetStats(childId: string | null, stats: PetStats): Promise<void> {
  try {
    await AsyncStorage.setItem(
      keyFor(childId),
      JSON.stringify({ stats, ts: Date.now() }),
    );
  } catch {
    // Persistence is a nicety, never a hard failure.
  }
}
