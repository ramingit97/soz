import { getLesson } from '@/data/lessons';

interface WordGameRound {
  emoji: string;
  correct: string;
  options: string[];
}

/**
 * Picks 1-2 review rounds from past days based on a Leitner-like spacing:
 * — yesterday's word (high priority)
 * — word from 3 days ago (medium)
 * — word from 7 days ago (low)
 *
 * Returns rounds that should be mixed into today's word game.
 */
export function pickReviewRounds(lang: string, currentDay: number): WordGameRound[] {
  if (currentDay <= 1) return []; // No past lessons to review yet

  const candidateOffsets = [1, 3, 7].filter((d) => currentDay - d >= 1);
  const reviews: WordGameRound[] = [];
  const seenWords = new Set<string>();

  for (const offset of candidateOffsets) {
    const pastDay = currentDay - offset;
    const past = getLesson(lang, pastDay);
    if (!past?.wordGame || past.wordGame.length === 0) continue;
    // Pick a deterministic but pseudo-random round (rotate by current day)
    const idx = (currentDay + offset) % past.wordGame.length;
    const round = past.wordGame[idx];
    if (round && !seenWords.has(round.correct)) {
      reviews.push(round);
      seenWords.add(round.correct);
      if (reviews.length >= 2) break;
    }
  }

  return reviews;
}

/**
 * Build the final word-game sequence: today's rounds + 1-2 review rounds shuffled in.
 * Reviews are placed in the middle of the sequence (not first, not last), so
 * the kid always opens with a fresh round and finishes with one too.
 */
export function buildWordGameWithReviews(
  todayRounds: WordGameRound[],
  reviewRounds: WordGameRound[],
): WordGameRound[] {
  if (reviewRounds.length === 0 || todayRounds.length === 0) return todayRounds;
  // Insert reviews at positions 1 and 2 (between rounds)
  const out = [...todayRounds];
  reviewRounds.forEach((review, i) => {
    const insertAt = Math.min(out.length - 1, i + 1);
    out.splice(insertAt, 0, review);
  });
  return out;
}
