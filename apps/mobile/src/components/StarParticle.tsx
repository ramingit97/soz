import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';

/** A single celebratory star that pops in, floats up and fades out.
 * Extracted from talk.tsx so lesson screens can reuse it. */
export function StarParticle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600 }),
      );
      translateY.value = withTiming(-60, { duration: 800 });
      scale.value = withSequence(withSpring(1.4), withTiming(0.6, { duration: 500 }));
    }, delay);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const stars = ['⭐', '✨', '🌟', '💫'];
  const star = stars[Math.abs(Math.round(x + y)) % stars.length];

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Text style={{ fontSize: 20 }}>{star}</Text>
    </Animated.View>
  );
}
