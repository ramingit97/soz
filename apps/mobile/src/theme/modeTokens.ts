/**
 * Токены возрастных режимов — всё, чем `kid` отличается от `teen`.
 *
 * Экраны не ветвятся по режиму сами, а берут значения отсюда (через
 * `useTheme().t` или `makeModeStyles`). Прямые развилки `mode ===` допустимы в
 * считанных местах, где отличается содержимое, а не размеры; `check-ui.mjs`
 * считает их.
 */
import type { ViewStyle } from 'react-native';

import type { UIMode } from './mode';
import { radius, shadow, spacing } from './spacing';
import { fontFamily, fontSize } from './typography';

type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export interface ModeTokens {
  mode: UIMode;
  font: {
    /** Крупные заголовки: `hero`, `title`. */
    display: string;
    /** Второй уровень: `headline`. */
    displaySemi: string;
    button: string;
  };
  heading: { hero: number; title: number; headline: number };
  button: { radius: number };
  card: { radius: number; shadow: Shadow };
  /** Размеры маскота. На коротком экране `useTheme` ужимает их ×0.75. */
  mascot: { hero: number; avatar: number; inline: number };
  density: { padX: number; cardPad: number; gap: number };
  /** Тёплая виньетка сверху фона. */
  vignette: boolean;
  iconStroke: number;
  /** Сколько конфетти на празднике урока: малышам больше, подростку сдержаннее. */
  confetti: number;
}

export const MODE_TOKENS: Record<UIMode, ModeTokens> = {
  kid: {
    mode: 'kid',
    font: {
      display: fontFamily.display,
      displaySemi: fontFamily.displaySemi,
      button: fontFamily.display,
    },
    heading: { hero: fontSize['4xl'], title: fontSize['3xl'], headline: fontSize['2xl'] },
    button: { radius: radius.xl },
    card: { radius: radius.xl, shadow: shadow.card },
    mascot: { hero: 160, avatar: 36, inline: 56 },
    density: { padX: spacing[5], cardPad: spacing[4], gap: spacing[3] },
    vignette: true,
    iconStroke: 2.25,
    confetti: 24,
  },
  teen: {
    mode: 'teen',
    font: {
      display: fontFamily.teenDisplay,
      displaySemi: fontFamily.teenDisplaySemi,
      button: fontFamily.teenDisplaySemi,
    },
    heading: { hero: fontSize['3xl'], title: fontSize['2xl'], headline: fontSize.xl },
    button: { radius: 14 },
    card: { radius: radius.lg, shadow: shadow.sm },
    mascot: { hero: 96, avatar: 28, inline: 40 },
    density: { padX: spacing[4], cardPad: spacing[3], gap: spacing[2] },
    vignette: false,
    iconStroke: 1.75,
    confetti: 10,
  },
};

/**
 * Стили, зависящие от режима, без `StyleSheet.create` на каждом рендере: оба
 * набора строятся один раз при загрузке модуля, компонент выбирает нужный.
 *
 *   const modeStyles = makeModeStyles((t) => StyleSheet.create({ ... }));
 *   const styles = modeStyles[useUIMode()];
 */
export function makeModeStyles<T>(build: (t: ModeTokens) => T): Record<UIMode, T> {
  return { kid: build(MODE_TOKENS.kid), teen: build(MODE_TOKENS.teen) };
}
