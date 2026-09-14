/**
 * Когда разговор в уроке можно засчитать.
 *
 * Баг, найденный владельцем 2026-09-14: в режиме урока в углу экрана разговора
 * стояла галочка, которая сразу открывала «Урок выполнен» — можно было не сказать
 * ни слова и получить звёзды, серию и следующий день. Теперь урок засчитывается
 * только за настоящий разговор, а кнопка в углу просто выходит без награды.
 */

/** Столько реплик ребёнок должен сказать, чтобы разговорный шаг урока засчитался. */
export const MIN_LESSON_TALK_TURNS = 3;

interface TurnLike {
  role: string;
  text: string;
}

/**
 * Реплики ребёнка, в которых распознана речь. Пустое распознавание экран пишет в
 * историю как «...» — это не разговор.
 */
export function spokenTurns(history: TurnLike[]): number {
  return history.filter((t) => {
    if (t.role !== 'child') return false;
    const text = t.text.trim();
    return text.length > 0 && text !== '...';
  }).length;
}

/**
 * Урок-разговор «на время» (`convo`) дополнительно ждёт, пока персонаж сам
 * завершит беседу (`wrapUnlocked`), — это его прежнее правило, минимум реплик
 * добавлен сверху, чтобы молчание не дожидалось таймера.
 */
export function canFinishTalkLesson(args: {
  spoken: number;
  convoLesson: boolean;
  wrapUnlocked: boolean;
}): boolean {
  if (args.spoken < MIN_LESSON_TALK_TURNS) return false;
  return args.convoLesson ? args.wrapUnlocked : true;
}
