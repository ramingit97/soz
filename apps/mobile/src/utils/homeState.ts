/**
 * Что показывает главная карточка «Урок дня» и из каких шагов состоит урок.
 *
 * Чистые функции без React — их проверяет `node --test`. Порядок проверок в
 * `deriveHomeState` — это приоритет. Первым — «сегодня уже сделано»: завершение
 * урока сразу переводит счётчик на следующий день, и всё остальное (нужен
 * аккаунт, нужен Premium, следующий урок ещё собирается) относится уже к завтра.
 * Потом то, что блокирует урок, и только затем сам урок.
 */

export type HomeState =
  | 'register'
  | 'preparing'
  | 'error'
  | 'generating'
  | 'paywall'
  | 'done'
  | 'quiz'
  | 'lesson';

export interface HomeStateInput {
  /** Гость или вовсе без аккаунта. */
  isTrialMode: boolean;
  currentDay: number;
  needsUpgrade: boolean;
  /** День после встроенных 30 — план целиком генерирует AI. */
  isAiDay: boolean;
  /** Урок дней 1–30 уже скачан (или качать нечего). */
  curriculumReady: boolean;
  curriculumError: boolean;
  hasLesson: boolean;
  doneToday: boolean;
  isQuizDay: boolean;
}

export function deriveHomeState(i: HomeStateInput): HomeState {
  if (i.doneToday) return 'done';
  // Пробный период — первый день. Дальше прогресс надо сохранить в аккаунт —
  // когда ребёнок придёт за следующим уроком, а не в минуту окончания первого.
  if (i.isTrialMode && i.currentDay > 1) return 'register';
  if (!i.isAiDay && !i.curriculumReady && !i.needsUpgrade) {
    return i.curriculumError ? 'error' : 'preparing';
  }
  if (i.isAiDay && !i.hasLesson && !i.needsUpgrade) return 'generating';
  if (i.needsUpgrade) return 'paywall';
  if (i.isQuizDay) return 'quiz';
  return 'lesson';
}

export type PlanStep = 'words' | 'reading' | 'grammar' | 'listening' | 'talk' | 'quiz';

/** Первый непройденный шаг урока; null — пройдены все. */
export function resumeStep(steps: PlanStep[], done: readonly string[]): PlanStep | null {
  return steps.find((s) => !done.includes(s)) ?? null;
}

export type LessonFocusKind = 'story_listen' | 'conversation' | 'vocab_grammar' | 'review';

/**
 * Шаги сегодняшнего урока — ровно те экраны, через которые он проведёт.
 *
 * Упор дня (`focus`) ставит генератор плана, и на него влияет выбор родителя в
 * онбординге: «Слушать» — больше дней-историй, «Говорить» — больше дней-разговоров.
 * Поэтому разговор на тему и история на слух — не отдельные плитки, а дни плана.
 */
export function todayPlanSteps(args: {
  focus: LessonFocusKind | undefined;
  mature: boolean;
  isQuizDay: boolean;
}): PlanStep[] {
  if (args.isQuizDay) return ['quiz'];
  if (args.focus === 'story_listen') return ['listening'];
  if (args.focus === 'conversation') return ['talk'];
  // lessonFlow: дети — игра со словами → грамматика → разговор;
  // подростки и B1+ — чтение → грамматика → разговор.
  return args.mature ? ['reading', 'grammar', 'talk'] : ['words', 'grammar', 'talk'];
}
