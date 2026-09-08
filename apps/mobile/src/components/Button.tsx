/**
 * Button — Honeybear claymorphism style.
 *
 * Primary: peach gradient + dark "rim" line at bottom (pillowy look).
 * Secondary: cream card with peach border + ink text.
 * Ghost: transparent + muted text.
 *
 * Keeps the original API (label, onPress, variant, size, fullWidth, etc.)
 * so all existing usages continue to work.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: ViewStyle;
}

const sizeMap: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  lg: { paddingVertical: 14, paddingHorizontal: spacing[6], fontSize: fontSize.lg },
  md: { paddingVertical: 11, paddingHorizontal: spacing[5], fontSize: fontSize.base },
  sm: { paddingVertical: 8, paddingHorizontal: spacing[4], fontSize: fontSize.sm },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  disabled,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const sizing = sizeMap[size];

  const pressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 250 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 250 });
  };

  const containerBase: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sizing.paddingVertical,
    paddingHorizontal: sizing.paddingHorizontal,
    borderRadius: radius.xl,
    gap: spacing[2],
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.4 : 1,
  };

  if (variant === 'primary') {
    return (
      <Animated.View style={[aStyle, fullWidth && { width: '100%' }, shadow.deep, style]}>
        <Pressable onPress={handlePress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
          <LinearGradient
            colors={['#F0A170', colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              containerBase,
              {
                borderRadius: radius.xl,
                borderBottomWidth: 4,
                borderBottomColor: colors.primaryDeep,
              },
            ]}
          >
            {leftIcon}
            <Text
              style={{
                color: colors.white,
                fontFamily: fontFamily.display,
                fontSize: sizing.fontSize,
                letterSpacing: 0.2,
              }}
            >
              {label}
            </Text>
            {rightIcon}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'secondary') {
    return (
      <Animated.View style={[aStyle, fullWidth && { width: '100%' }, shadow.sm, style]}>
        <Pressable onPress={handlePress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
          <View
            style={[
              containerBase,
              {
                backgroundColor: colors.card,
                borderBottomWidth: 3,
                borderBottomColor: colors.bgDeep,
              },
            ]}
          >
            {leftIcon}
            <Text
              style={{
                color: colors.ink,
                fontFamily: fontFamily.display,
                fontSize: sizing.fontSize,
                letterSpacing: 0.2,
              }}
            >
              {label}
            </Text>
            {rightIcon}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[aStyle, fullWidth && { width: '100%' }, style]}>
      <Pressable onPress={handlePress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
        <View style={containerBase}>
          {leftIcon}
          <Text
            style={{
              color: colors.inkSoft,
              fontFamily: fontFamily.bodyBold,
              fontSize: sizing.fontSize,
            }}
          >
            {label}
          </Text>
          {rightIcon}
        </View>
      </Pressable>
    </Animated.View>
  );
}
