/**
 * HBButton — единственная кнопка приложения (прежний `Button.tsx` влит сюда).
 *
 * Matte gradient surface with a single warm top highlight (light from above).
 * Press = anisotropic spring squish (scaleX 0.96 / scaleY 0.92 + sink) with
 * light haptics. Радиус и шрифт подписи — из возрастного режима.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useAccent } from '@/hooks/useAccent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useUIMode } from '@/hooks/useUIMode';
import { colors, fontSize, shadow, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

interface HBButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'accent' | 'butter' | 'berry' | 'soft' | 'ghost';
  size?: 'lg' | 'md' | 'sm';
  full?: boolean;
  /** Иконка слева от подписи. */
  icon?: IconName;
  /** Иконка справа (стрелка «дальше»). */
  iconRight?: IconName;
  /** Крутилка вместо левой иконки; нажатие заблокировано. */
  loading?: boolean;
  /** Для особых случаев, когда нужен не Icon. */
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS: Record<
  NonNullable<HBButtonProps['variant']>,
  { top: string; bottom: string; text: string }
> = {
  // Matte: top only ~3% lighter than bottom (no plastic sheen)
  primary: { top: '#EC9C64', bottom: colors.primary, text: '#FFFFFF' },
  accent: { top: '#86D0BE', bottom: colors.accent, text: '#FFFFFF' },
  butter: { top: '#F7D972', bottom: colors.butter, text: colors.ink },
  berry: { top: '#E86A80', bottom: colors.berry, text: '#FFFFFF' },
  soft: { top: colors.surface, bottom: colors.surface, text: colors.ink },
  ghost: { top: 'transparent', bottom: 'transparent', text: colors.inkSoft },
};

export function HBButton({
  label,
  variant = 'primary',
  size = 'lg',
  full,
  icon,
  iconRight,
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: HBButtonProps) {
  // The primary CTA wears the app accent (= the pet's color). Default honey hue
  // resolves to the brand peach, so unchanged for anyone who kept the default.
  // Other variants stay their explicit semantic color.
  const accent = useAccent();
  const t = MODE_TOKENS[useUIMode()];
  const v = variant === 'primary'
    ? { top: accent.top, bottom: accent.bottom, text: accent.text }
    : VARIANT_COLORS[variant];
  const isFlat = variant === 'soft' || variant === 'ghost';
  const inactive = !!disabled || loading;
  const padV = size === 'lg' ? 14 : size === 'md' ? 11 : 8;
  const padH = size === 'lg' ? 22 : size === 'md' ? 16 : 12;
  const fs = size === 'lg' ? fontSize.lg : size === 'md' ? fontSize.base : fontSize.sm;
  const iconSize = Math.round(fs * 1.15);

  const reduced = useReducedMotion();
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const ty = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: sx.value }, { scaleY: sy.value }, { translateY: ty.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (reduced) {
      sx.value = withTiming(0.98, { duration: 60 });
      sy.value = withTiming(0.98, { duration: 60 });
    } else {
      sx.value = withSpring(0.96, { damping: 16, stiffness: 320 });
      sy.value = withSpring(0.92, { damping: 16, stiffness: 320 });
      ty.value = withSpring(2, { damping: 16, stiffness: 320 });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (reduced) {
      sx.value = withTiming(1, { duration: 90 });
      sy.value = withTiming(1, { duration: 90 });
    } else {
      sx.value = withSpring(1, { damping: 11, stiffness: 220 });
      sy.value = withSpring(1, { damping: 11, stiffness: 220 });
      ty.value = withSpring(0, { damping: 11, stiffness: 220 });
    }
    onPressOut?.(e);
  };

  const leading = loading ? (
    <ActivityIndicator size="small" color={v.text} />
  ) : icon ? (
    <Icon name={icon} size={iconSize} color={v.text} />
  ) : (
    leadingIcon
  );
  const trailing = iconRight ? <Icon name={iconRight} size={iconSize} color={v.text} /> : trailingIcon;

  return (
    <Pressable
      {...rest}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[full ? { width: '100%' } : undefined, style]}
    >
      <Animated.View
        style={[
          { borderRadius: t.button.radius },
          !isFlat && !inactive && shadow.md,
          inactive && styles.inactive,
          aStyle,
        ]}
      >
        <LinearGradient
          colors={[v.top, v.bottom]}
          style={[
            styles.inner,
            {
              borderRadius: t.button.radius,
              paddingVertical: padV,
              paddingHorizontal: padH,
              backgroundColor: v.bottom,
            },
            variant === 'soft' ? styles.softBorder : !isFlat && styles.highlight,
          ]}
        >
          {leading ? <View style={styles.iconSlot}>{leading}</View> : null}
          <Text style={{ color: v.text, fontSize: fs, fontFamily: t.font.button, letterSpacing: 0 }}>
            {label}
          </Text>
          {trailing ? <View style={styles.iconSlot}>{trailing}</View> : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    overflow: 'hidden',
  },
  highlight: {
    borderTopWidth: 1.5,
    borderTopColor: colors.highlightWarm,
  },
  softBorder: {
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  inactive: {
    opacity: 0.45,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
