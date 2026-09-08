/**
 * HBButton — Honeybear Pro pillowy button.
 *
 * Matte gradient surface with a single warm top highlight (light from above)
 * instead of the old neomorphism double-rim. Press = anisotropic spring squish
 * (scaleX 0.96 / scaleY 0.92 + sink) with light haptics. API unchanged.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from './Text';
import { useAccent } from '@/hooks/useAccent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

interface HBButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'accent' | 'butter' | 'berry' | 'soft' | 'ghost';
  size?: 'lg' | 'md' | 'sm';
  full?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
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
  soft: { top: colors.card, bottom: colors.card, text: colors.ink },
  ghost: { top: 'transparent', bottom: 'transparent', text: colors.ink },
};

export function HBButton({
  label,
  variant = 'primary',
  size = 'lg',
  full,
  leadingIcon,
  trailingIcon,
  onPressIn,
  onPressOut,
  ...rest
}: HBButtonProps) {
  // The primary CTA wears the app accent (= the pet's color). Default honey hue
  // resolves to the brand peach, so unchanged for anyone who kept the default.
  // Other variants stay their explicit semantic color.
  const accent = useAccent();
  const v = variant === 'primary'
    ? { top: accent.top, bottom: accent.bottom, text: accent.text }
    : VARIANT_COLORS[variant];
  const isFlat = variant === 'soft' || variant === 'ghost';
  const padV = size === 'lg' ? 14 : size === 'md' ? 11 : 8;
  const padH = size === 'lg' ? 22 : size === 'md' ? 16 : 12;
  const fs = size === 'lg' ? fontSize.lg : size === 'md' ? fontSize.base : fontSize.sm;

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

  return (
    <Pressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={full ? { width: '100%' } : undefined}
    >
      <Animated.View style={[styles.wrap, !isFlat && shadow.md, aStyle]}>
        <LinearGradient
          colors={[v.top, v.bottom]}
          style={[
            styles.inner,
            {
              paddingVertical: padV,
              paddingHorizontal: padH,
              backgroundColor: v.bottom,
              borderTopWidth: isFlat ? 0 : 1.5,
              borderTopColor: colors.highlightWarm,
            },
          ]}
        >
          {leadingIcon ? <View style={styles.iconSlot}>{leadingIcon}</View> : null}
          <Text style={[styles.label, { color: v.text, fontSize: fs }]}>{label}</Text>
          {trailingIcon ? <View style={styles.iconSlot}>{trailingIcon}</View> : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
  },
  inner: {
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    overflow: 'hidden',
  },
  label: {
    fontFamily: fontFamily.display,
    letterSpacing: 0,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
