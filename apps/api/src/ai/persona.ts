/**
 * Кто такой персонаж для этого ученика: медвежонок или робот, и как его зовут.
 *
 * Решение владельца 2026-09-14: у детей до 10 лет — медвежонок, у подростков и
 * взрослых — робот; имя по умолчанию Bobo (по-русски Бобо). Порог тот же, что у
 * возрастного режима интерфейса в приложении (`apps/mobile/src/theme/mode.ts`),
 * чтобы персонаж на экране и в разговоре совпадал.
 */

export type CompanionKind = 'bear' | 'robot';

/** Старший возраст медвежонка. Совпадает с KID_MAX_AGE в приложении. */
export const BEAR_MAX_AGE = 10;

/**
 * Возраст точнее возрастной группы: группа `mid` покрывает и 8–10, и 11–13 лет,
 * а персонажи у них разные. Группа — запасной вариант, когда возраста нет.
 */
export function companionKind(
  childAge: number | null | undefined,
  ageBand: string | null | undefined,
): CompanionKind {
  if (ageBand === 'adult') return 'robot';
  if (typeof childAge === 'number') return childAge <= BEAR_MAX_AGE ? 'bear' : 'robot';
  return ageBand === 'teen' ? 'robot' : 'bear';
}

/**
 * Имена, которые означают «ребёнок не называл персонажа». «Хани»/«Hani» — прежнее
 * имя по умолчанию: у профилей, созданных до смены, оно могло сохраниться в
 * `children.petName` из подсказки на экране питомца.
 */
const DEFAULT_NAMES = ['Bobo', 'Бобо', 'Хани', 'Hani'];

export function companionName(petName: string | null | undefined, language: 'en' | 'ru'): string {
  const name = petName?.trim();
  if (name && !DEFAULT_NAMES.includes(name)) return name;
  return language === 'ru' ? 'Бобо' : 'Bobo';
}
