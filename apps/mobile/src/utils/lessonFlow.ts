/**
 * Level/age-appropriate lesson flow (founder decision 2026-07-04: "у каждого
 * уровня свой подход" — a B2 learner must never be asked to say a magic word
 * aloud or assemble a 4-word sentence).
 *
 * Kid flow (young/mid, A1-A2):    playful rotation quest/tpr/pretend/world
 *                                 → word-game → grammar → talk
 * Mature flow (teen/adult or B1+): text-first — reading (story) → grammar
 *                                 (level-appropriate via the AI plan) → talk.
 *                                 No say-the-magic-word, no emoji word-game.
 */

export const KID_LESSON_MODES = ['quest', 'tpr', 'pretend', 'world'] as const;

export function isMatureLearner(
  level: string | null | undefined,
  ageBand: string | null | undefined,
): boolean {
  return (
    ageBand === 'teen' ||
    ageBand === 'adult' ||
    level === 'pre_intermediate' ||
    level === 'intermediate'
  );
}

/** Режим дня в ротации малышей. День 0 или отрицательный не роняет маршрут в `undefined`. */
export function kidModeForDay(day: number): (typeof KID_LESSON_MODES)[number] {
  const n = KID_LESSON_MODES.length;
  return KID_LESSON_MODES[(((day - 1) % n) + n) % n]!;
}

function kidModeRoute(day: number, lang: string): string {
  return `/lesson/${kidModeForDay(day)}?lang=${lang}&day=${day}`;
}

/** Entry route for today's main lesson («Урок дня» / the path node). */
export function lessonEntryRoute(day: number, lang: string, mature: boolean): string {
  return mature ? `/read?lang=${lang}&day=${day}` : kidModeRoute(day, lang);
}

/** Where the reading screen continues after the last story scene. */
export function afterReadingRoute(day: number, lang: string, mature: boolean): string {
  return mature ? `/lesson/grammar?lang=${lang}&day=${day}` : kidModeRoute(day, lang);
}

/**
 * Куда ведёт конкретный шаг урока — чтобы продолжить с того места, где ребёнок
 * остановился, а не начинать урок сначала.
 */
export function lessonStepRoute(
  step: string,
  focus: string | undefined,
  day: number,
  lang: string,
  mature: boolean,
): string {
  switch (step) {
    case 'grammar':
      return `/lesson/grammar?lang=${lang}&day=${day}`;
    case 'talk':
      return focus === 'conversation'
        ? `/talk?lang=${lang}&day=${day}&fromLesson=1&convo=1`
        : `/talk?lang=${lang}&day=${day}&fromLesson=1`;
    case 'reading':
      return `/read?lang=${lang}&day=${day}`;
    case 'listening':
      return `/listening?lang=${lang}&day=${day}&fromLesson=1`;
    default:
      return lessonStartRoute(focus, day, lang, mature);
  }
}

/**
 * С чего начинается урок дня. Упор дня (`focus` из плана) решает первый экран:
 * день-история — история на слух, день-разговор — разговор с персонажем, иначе
 * обычный поток. `fromLesson=1` важен: без него экран не знает, что это урок, и
 * не засчитывает его — дни-истории так и оставались незавершёнными.
 */
export function lessonStartRoute(
  focus: string | undefined,
  day: number,
  lang: string,
  mature: boolean,
): string {
  if (focus === 'story_listen') return `/listening?lang=${lang}&day=${day}&fromLesson=1`;
  if (focus === 'conversation') return `/talk?lang=${lang}&day=${day}&fromLesson=1&convo=1`;
  return lessonEntryRoute(day, lang, mature);
}
