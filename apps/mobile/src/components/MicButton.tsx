import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, radius, shadow } from '@/theme';

interface MicButtonProps {
  state: 'idle' | 'recording' | 'thinking' | 'playing';
  /**
   * Нажатие, а не удержание: первое начинает запись, запись сама останавливается,
   * когда ребёнок замолчал; второе нажатие останавливает раньше. Держать палец
   * на кнопке маленькому ребёнку трудно, а в Safari удержание ещё и выделяет текст.
   */
  onPress: () => void;
  disabled?: boolean;
}

export function MicButton({ state, onPress, disabled }: MicButtonProps) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state === 'recording') {
      pulse.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      scale.value = withSpring(1.08, { damping: 10, stiffness: 180 });
    } else if (state === 'thinking') {
      pulse.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    } else {
      pulse.value = withTiming(0, { duration: 200 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, [state, pulse, scale]);

  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.3 }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  const buttonColor =
    state === 'recording'
      ? colors.accentPink
      : state === 'thinking'
        ? colors.accentYellow
        : state === 'playing'
          ? colors.accent
          : colors.primary;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.ring,
          ring2Style,
          { backgroundColor: buttonColor, opacity: 0.15 },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          ringStyle,
          { backgroundColor: buttonColor, opacity: 0.25 },
        ]}
      />
      {/* Скругление обязательно: в браузере тень рисуется по рамке блока — был квадрат. */}
      <Animated.View style={[aStyle, shadow.glow, styles.glow]}>
        <Pressable
          disabled={disabled}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onPress();
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!disabled, busy: state === 'recording' }}
          style={[styles.button, { backgroundColor: buttonColor, opacity: disabled ? 0.4 : 1 }]}
        >
          {state === 'thinking' ? <ThinkingDots /> : <MicIcon />}
        </Pressable>
      </Animated.View>
    </View>
  );
}

function MicIcon() {
  return (
    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" fill="white" />
      <Path
        d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ThinkingDots() {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const cc = useSharedValue(0);

  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    b.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    cc.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
  }, [a, b, cc]);

  const dotA = useAnimatedStyle(() => ({ opacity: 0.4 + a.value * 0.6 }));
  const dotB = useAnimatedStyle(() => ({ opacity: 0.3 + b.value * 0.7 }));
  const dotC = useAnimatedStyle(() => ({ opacity: 0.4 + cc.value * 0.6 }));

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Animated.View style={[styles.dot, dotA]} />
      <Animated.View style={[styles.dot, dotB]} />
      <Animated.View style={[styles.dot, dotC]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Кольца пульса шире (до ~186) и выходят за блок — места под них не держим,
    // иначе на низком экране микрофон упирается во вкладки.
    width: 200,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: radius.full,
  },
  glow: {
    borderRadius: radius.full,
  },
  button: {
    width: 110,
    height: 110,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
  },
});
