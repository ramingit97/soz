import { useEffect, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { playSfx } from '@/services/sfx';

interface AnimatedCountProps {
  value: number;
  /** Total count-up time in ms. */
  duration?: number;
  /** Delay before counting starts, in ms. */
  delay?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  /** Play a tiny tick on count steps (capped at ~12 audible ticks). */
  tickSound?: boolean;
}

/** Number that counts up with a decelerating ease and a pulse per step. */
export function AnimatedCount({
  value,
  duration = 900,
  delay = 0,
  format,
  style,
  tickSound,
}: AnimatedCountProps) {
  const [display, setDisplay] = useState(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tickEvery = Math.max(1, Math.ceil(value / 12));
    const start = Date.now() + delay;
    const loop = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / duration));
      const v = Math.round((1 - Math.pow(1 - t, 3)) * value); // cubic ease-out
      if (v !== last) {
        last = v;
        setDisplay(v);
        scale.value = withSequence(
          withTiming(1.12, { duration: 40 }),
          withTiming(1, { duration: 90 }),
        );
        if (tickSound && v > 0 && v % tickEvery === 0) playSfx('tick', 0.5);
      }
      if (t < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.Text style={[style, aStyle]}>
      {format ? format(display) : String(display)}
    </Animated.Text>
  );
}
