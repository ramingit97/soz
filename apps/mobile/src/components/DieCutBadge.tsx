/**
 * DieCutBadge — vinyl "sticker" treatment for rewards: white die-cut edge, a
 * slight tilt, and a slap-on pop when it appears. Honeybear Pro uses this ONLY
 * on rewards (lesson complete, achievements) — not as a general surface language.
 */

import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { shadow } from '@/theme';

interface Props {
  children: React.ReactNode;
  size?: number;
  tilt?: number; // degrees
  edge?: number; // white edge width
  edgeColor?: string;
  bg?: string;
  delay?: number;
  style?: ViewStyle | ViewStyle[];
}

export function DieCutBadge({
  children,
  size = 96,
  tilt = -5,
  edge = 3,
  edgeColor = '#FFFFFF',
  bg = '#FFFFFF',
  delay = 0,
  style,
}: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);
  const rot = useSharedValue(reduced ? tilt : 0);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      rot.value = tilt;
      return;
    }
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.12, { damping: 9, stiffness: 220 }),
        withSpring(1, { damping: 12 }),
      ),
    );
    rot.value = withDelay(delay, withSpring(tilt, { damping: 10 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: edge,
          borderColor: edgeColor,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadow.md,
        aStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default DieCutBadge;
