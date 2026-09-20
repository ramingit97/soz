/**
 * HBCard — поверхность карточки.
 *
 * По умолчанию белая с тонкой рамкой и лёгкой тенью. Раньше была кремовой на
 * кремовом фоне с одинаковой мягкой тенью везде, и на device QA карточки не
 * отделялись от фона — взгляду не за что было зацепиться. Радиус и тень обычной
 * карточки берутся из возрастного режима.
 *
 * Глубокая тень (`deep`) — только для одного главного блока на экране.
 */

import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useUIMode } from '@/hooks/useUIMode';
import { shadow } from '@/theme';
import { MODE_TOKENS, makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

interface HBCardProps extends ViewProps {
  padded?: boolean;
  /** Тёплый блик по верхнему краю — прежний «глиняный» вид. */
  rim?: boolean;
  ringColor?: string;
  /** Цветная карточка. Рамка у неё не рисуется — отделяет сам цвет. */
  bg?: string;
  depth?: 'sm' | 'md' | 'deep' | 'none';
  style?: StyleProp<ViewStyle>;
}

export function HBCard({
  children,
  padded = true,
  rim = false,
  ringColor,
  bg,
  depth = 'md',
  style,
  ...rest
}: HBCardProps) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const t = MODE_TOKENS[useUIMode()];
  const depthStyle =
    depth === 'sm'
      ? shadow.sm
      : depth === 'md'
      ? t.card.shadow
      : depth === 'deep'
      ? shadow.deep
      : undefined;

  return (
    <View
      {...rest}
      style={[
        { borderRadius: t.card.radius, backgroundColor: bg ?? c.surface },
        padded && { padding: t.density.cardPad },
        !bg && !ringColor && styles.border,
        rim && styles.rim,
        ringColor ? { borderColor: ringColor, borderWidth: 2.5 } : null,
        depthStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  border: {
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
  },
  rim: {
    borderTopWidth: 1.5,
    borderTopColor: t.c.highlightWarm,
  },
}));
