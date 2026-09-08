/**
 * Bobo — the mascot, now rendered as Honeybear's "Хани" clay-blob.
 *
 * This is a thin wrapper around `HBPet` that preserves the original Bobo API
 * (size, mood, style) plus subtle breathing animation, so every screen that
 * already imports `<Bobo />` automatically picks up the new claymorphism
 * mascot without code changes.
 */

import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HBPet } from './HBPet';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme';

interface BoboProps {
  size?: number;
  mood?: 'happy' | 'curious' | 'sleepy' | 'sad';
  style?: ViewStyle;
  /** Optional hue override. If omitted, reads `petHue` from settings (default 55). */
  hue?: number;
  /** Render the soft halo behind the mascot (default: true). */
  halo?: boolean;
}

const MOOD_MAP = {
  happy: 'happy' as const,
  curious: 'curious' as const,
  sleepy: 'sleepy' as const,
  sad: 'sad' as const,
};

export function Bobo({
  size = 220,
  mood = 'happy',
  style,
  hue,
  halo = true,
}: BoboProps) {
  const storedHue = useSettings((s) => s.petHue);
  const effectiveHue = hue ?? storedHue ?? 55;
  const breath = useSharedValue(0);
  const glow = useSharedValue(0.6);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, glow]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -breath.value * 5 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.25,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {halo && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size * 1.0,
              height: size * 1.0,
              borderRadius: size,
              backgroundColor: 'rgba(245, 212, 102, 0.4)',
            },
            glowStyle,
          ]}
        />
      )}

      <Animated.View style={wrapperStyle}>
        <HBPet size={size * 0.72} hue={effectiveHue} mood={MOOD_MAP[mood]} />
      </Animated.View>

      {/* Soft floor shadow for grounding */}
      {halo && (
        <View
          style={{
            position: 'absolute',
            bottom: size * 0.08,
            width: size * 0.55,
            height: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(60, 49, 33, 0.15)',
          }}
        />
      )}
    </View>
  );
}

// Re-export for callsites that may want the colors helper (keeps API stable).
export const BOBO_COLORS = {
  bg: colors.bg,
  primary: colors.primary,
};
