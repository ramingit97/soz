/**
 * Возрастной режим интерфейса: `kid` (5–10) и `teen` (11–16 и взрослые).
 *
 * Один визуальный язык на 5 и на 15 лет не работал: пастель и крупный медвежонок
 * — это язык малышей, тринадцатилетний закрывает такое как «приложение для
 * маленьких». Палитра, акцент от цвета питомца и навигация в обоих режимах
 * одинаковые; различаются шрифт заголовков, радиусы, плотность, размер маскота
 * (таблица в ./modeTokens.ts).
 *
 * Модуль намеренно без React Native — его проверяет `node --test`.
 */
import type { AgeRange, ProfileType } from '../store/settings';

export type UIMode = 'kid' | 'teen';

/** Старший возраст режима kid. Совпадает с правилом основателя «до 10 — игровой». */
export const KID_MAX_AGE = 10;

/**
 * Режим для текущего профиля.
 *
 * Считаем в первую очередь от `childAge`: `syncChild()` приносит с сервера
 * возраст, но не `childAgeRange`, поэтому после смены профиля диапазон остаётся
 * от предыдущего ребёнка. Диапазон — запасной вариант для экранов онбординга,
 * где возраст ещё не записан. Пока о ребёнке ничего не известно — `kid`: это
 * детское приложение, и первый экран должен выглядеть так.
 */
export function uiModeFor(
  profileType: ProfileType | null | undefined,
  childAge: number | null | undefined,
  childAgeRange: AgeRange | null | undefined,
): UIMode {
  if (profileType === 'adult') return 'teen';
  if (typeof childAge === 'number') return childAge <= KID_MAX_AGE ? 'kid' : 'teen';
  if (childAgeRange) return childAgeRange === '5-7' || childAgeRange === '8-10' ? 'kid' : 'teen';
  return 'kid';
}

/**
 * Персонаж профиля: медвежонок в режиме kid, робот в teen. Тот же порог у
 * сервера (`apps/api/src/ai/persona.ts`), чтобы на экране и в разговоре был один
 * персонаж. Считается по профилю, а не по принудительному режиму экрана: в
 * родительской зоне персонаж шестилетки остаётся медвежонком.
 */
export function companionKindFor(
  profileType: ProfileType | null | undefined,
  childAge: number | null | undefined,
  childAgeRange: AgeRange | null | undefined,
): 'bear' | 'robot' {
  return uiModeFor(profileType, childAge, childAgeRange) === 'kid' ? 'bear' : 'robot';
}
