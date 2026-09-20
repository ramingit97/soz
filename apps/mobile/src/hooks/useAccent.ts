import { useUIMode } from '@/hooks/useUIMode';
import { accentFor, type Accent } from '@/theme/accent';

/**
 * Акцент текущего режима (`@/theme/accent`). Перерисовывается при смене профиля
 * на другой возраст, а не при перекраске питомца.
 */
export function useAccent(): Accent {
  return accentFor(useUIMode());
}
