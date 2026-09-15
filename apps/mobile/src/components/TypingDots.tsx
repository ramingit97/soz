/**
 * Три точки, которые загораются по очереди, — «думаю». Одна анимация на все три
 * точки: у каждой свой сдвиг фазы, а не свой таймер.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export function TypingDots({ color, size = 10 }: { color: string; size?: number }) {
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = withRepeat(withTiming(3, { duration: 900, easing: Easing.linear }), -1, false);
  }, [clock]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.8) }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} clock={clock} color={color} size={size} />
      ))}
    </View>
  );
}

function Dot({
  index,
  clock,
  color,
  size,
}: {
  index: number;
  clock: SharedValue<number>;
  color: string;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (clock.value - index + 3) % 3;
    return { opacity: phase < 1 ? 1 - phase * 0.6 : 0.4 };
  });
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
