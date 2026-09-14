import { useSettings } from '@/store/settings';

/**
 * Имя персонажа по умолчанию — Бобо (лат. Bobo). Решение владельца 2026-09-14;
 * до этого было «Хани», ещё раньше — «Bobo». Тексты интерфейса и уроков написаны
 * с именем по умолчанию, а имя, которое дал ребёнок, подставляется поверх.
 *
 * «Хани» и «Hani» остаются в списке имён по умолчанию: у профилей, созданных до
 * смены имени, на сервере могло сохраниться `petName: 'Хани'` из подсказки на
 * экране питомца. Такой профиль показывает Бобо, а не старое имя.
 */
const DEFAULT_NAME_RU = 'Бобо';
const DEFAULT_NAME_AZ = 'Bobo';
const DEFAULT_NAMES = ['Бобо', 'Bobo', 'Хани', 'Hani'];

/** Имя по умолчанию для языка интерфейса родителя. */
export function defaultCompanionName(uiLanguage: string | null | undefined): string {
  return uiLanguage === 'az' ? DEFAULT_NAME_AZ : DEFAULT_NAME_RU;
}

/** Имя, которое дал ребёнок, или null, если он оставил имя по умолчанию. */
function customName(petName: string | null | undefined): string | null {
  const name = petName?.trim();
  return name && !DEFAULT_NAMES.includes(name) ? name : null;
}

/**
 * Replace the default companion name with the child's chosen pet name in any
 * display string. UI chrome and bundled lesson copy are authored with the
 * default; this swaps in the kid's name everywhere it's shown.
 */
export function withCompanionName(text: string, petName?: string | null): string {
  const name = customName(petName);
  if (!name) return text;
  return text.replace(/Bobo|Бобо|Хани|Hani/g, name);
}

/** То же вне React (уведомления, сервисы). */
export function companionNameFor(
  petName: string | null | undefined,
  uiLanguage: string | null | undefined,
): string {
  return customName(petName) ?? defaultCompanionName(uiLanguage);
}

/** The child's companion name for the active profile, falling back to the default. */
export function useCompanionName(): string {
  const petName = useSettings((s) => s.petName);
  const uiLanguage = useSettings((s) => s.parentUILanguage);
  return customName(petName) ?? defaultCompanionName(uiLanguage);
}
