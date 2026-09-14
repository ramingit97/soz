import { useMemo } from 'react';

import { useAccent } from '@/hooks/useAccent';
import { useCompactScreen } from '@/hooks/useCompactScreen';
import { useUIMode } from '@/hooks/useUIMode';
import { MODE_TOKENS, type ModeTokens } from '@/theme/modeTokens';

/** Во сколько раз ужимается маскот на коротком экране (A21s: 712 dp высоты). */
const SHORT_SCREEN_MASCOT = 0.75;

/**
 * Всё, что экрану нужно знать о теме: режим, его токены, акцент от цвета питомца
 * и размеры экрана. Маскот ужимается здесь, а не в экранах — иначе каждый экран
 * ветвился бы по высоте сам и забывал об этом.
 */
export function useTheme() {
  const mode = useUIMode();
  const accent = useAccent();
  const compact = useCompactScreen();

  const t = useMemo<ModeTokens>(() => {
    const base = MODE_TOKENS[mode];
    if (!compact.short) return base;
    const shrink = (px: number) => Math.round(px * SHORT_SCREEN_MASCOT);
    return {
      ...base,
      mascot: {
        hero: shrink(base.mascot.hero),
        avatar: base.mascot.avatar,
        inline: shrink(base.mascot.inline),
      },
    };
  }, [mode, compact.short]);

  return { mode, t, accent, compact };
}
