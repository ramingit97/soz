import { useSettings } from '@/store/settings';

const DEFAULT_NAME = 'Bobo';

/**
 * Replace the default companion name ("Bobo"/"Бобо") with the child's chosen pet
 * name in any display string. UI chrome and bundled lesson copy are authored with
 * "Bobo"; this swaps in the kid's name everywhere it's shown.
 */
export function withCompanionName(text: string, petName?: string | null): string {
  const name = petName?.trim();
  if (!name || name === DEFAULT_NAME) return text;
  return text.replace(/Bobo|Бобо/g, name);
}

/** The child's companion name for the active profile, falling back to "Bobo". */
export function useCompanionName(): string {
  const petName = useSettings((s) => s.petName);
  return petName?.trim() || DEFAULT_NAME;
}
