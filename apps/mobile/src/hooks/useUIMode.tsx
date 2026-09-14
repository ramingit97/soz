import { createContext, useContext, type ReactNode } from 'react';

import { useSettings } from '@/store/settings';
import { uiModeFor, type UIMode } from '@/theme/mode';

const ForcedMode = createContext<UIMode | null>(null);

/**
 * Принудительный режим для поддерева. Родительская зона (`parent*`, `paywall`,
 * `consent`, `register`) всегда `teen`: её читает взрослый, даже если ребёнку 6.
 *
 * Оборачивать сам экран, а не решать по `usePathname()` в корне: при переходе
 * путь меняется раньше, чем уезжает старый экран, и тот на время анимации
 * перерисовался бы в чужом режиме.
 */
export function UIModeProvider({ force, children }: { force: UIMode; children: ReactNode }) {
  return <ForcedMode.Provider value={force}>{children}</ForcedMode.Provider>;
}

/** Режим текущего профиля (или принудительный от ближайшего `UIModeProvider`). */
export function useUIMode(): UIMode {
  const forced = useContext(ForcedMode);
  // Один селектор со строкой на выходе: компонент перерисуется только при смене
  // режима, а не при каждом изменении возраста или диапазона.
  const fromProfile = useSettings((s) => uiModeFor(s.profileType, s.childAge, s.childAgeRange));
  return forced ?? fromProfile;
}
