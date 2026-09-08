/**
 * PopNumber — a big "dashboard" number that pops (scale 1 → 1.25 → 1) whenever its
 * value changes. Tabular figures so digits don't jitter. Honeybear Pro uses this for
 * streak / XP / stars counters. Respects reduce-motion.
 */

import { useEffect, useRef } from 'react';
import { type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Text } from './Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  value: number | string;
  style?: TextStyle | TextStyle[];
}

export function PopNumber({ value, style }: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // don't pop on initial mount
    }
    if (reduced) return;
    scale.value = withSequence(
      withSpring(1.25, { damping: 6, stiffness: 260 }),
      withSpring(1, { damping: 12 }),
    );
  }, [value, reduced]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={aStyle}>
      <Text style={[{ fontVariant: ['tabular-nums'] }, style as TextStyle]}>{value}</Text>
    </Animated.View>
  );
}

export default PopNumber;
