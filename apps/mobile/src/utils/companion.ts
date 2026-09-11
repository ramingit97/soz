import { useSettings } from '@/store/settings';

/**
 * Имя питомца по умолчанию — то, которое носит бренд: Хани (лат. Hani).
 *
 * Раньше здесь стояло 'Bobo', и это проступало на вводных экранах, где ребёнок
 * ещё не назвал питомца: «Bobo — друг, а не учитель» на первом слайде, а через
 * два экрана — «Хани подстроится под каждого». Один персонаж под двумя именами
 * в одном онбординге. В метаданных сторов и описаниях он тоже Хани.
 *
 * 'Bobo' и 'Бобо' остаются в списке подстановки: ими написана часть встроенного
 * контента уроков (src/data/lessons.ts), переписывать её незачем — замена и так
 * проходит через getLesson.
 */
const DEFAULT_NAME = 'Хани';
const DEFAULT_NAMES = ['Хани', 'Hani', 'Bobo', 'Бобо'];

/**
 * Replace the default companion name with the child's chosen pet name in any
 * display string. UI chrome and bundled lesson copy are authored with the
 * default; this swaps in the kid's name everywhere it's shown.
 */
export function withCompanionName(text: string, petName?: string | null): string {
  const name = petName?.trim();
  if (!name || DEFAULT_NAMES.includes(name)) return text;
  return text.replace(/Bobo|Бобо|Хани|Hani/g, name);
}

/** The child's companion name for the active profile, falling back to the brand name. */
export function useCompanionName(): string {
  const petName = useSettings((s) => s.petName);
  return petName?.trim() || DEFAULT_NAME;
}
