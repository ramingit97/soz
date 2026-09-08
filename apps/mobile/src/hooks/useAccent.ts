import { accentFor, type Accent } from '@/theme/accent';
import { useSettings } from '@/store/settings';

/**
 * The app's current accent, derived from the pet's chosen hue. Re-renders when
 * the child recolors the pet. Base surfaces stay cream; only accents follow.
 */
export function useAccent(): Accent {
  const petHue = useSettings((s) => s.petHue);
  return accentFor(petHue);
}
