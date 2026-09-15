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

import { Icon } from '@/components/Icon';
import { TypingDots } from '@/components/TypingDots';
import { useAccent } from '@/hooks/useAccent';
import { colors, radius } from '@/theme';

interface MicButtonProps {
  state: 'idle' | 'recording' | 'thinking' | 'playing';
  /**
   * Нажатие, а не удержание: первое начинает запись, запись сама останавливается,
   * когда ребёнок замолчал; второе нажатие останавливает раньше. Держать палец
   * на кнопке маленькому ребёнку трудно, а в Safari удержание ещё и выделяет текст.
   */
  onPress: () => void;
  disabled?: boolean;
  /** Подпись для экранного диктора. */
  accessibilityLabel?: string;
}

/**
 * Цвет кнопки — цвет питомца (акцент приложения): у ребёнка с голубым роботом
 * голубой микрофон. Запись — всегда ягодный, чтобы «я слушаю» не путалось с
 * «нажми». Пока персонаж думает или говорит, кнопка бледнеет и не нажимается.
 */
export function MicButton({ state, onPress, disabled, accessibilityLabel }: MicButtonProps) {
  const accent = useAccent();
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
    opacity: pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.3 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.2,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  const busy = state === 'thinking' || state === 'playing';
  const fill = state === 'recording' ? colors.berry : busy ? accent.soft : accent.bottom;
  const ink = state === 'recording' ? colors.white : busy ? accent.ink : accent.text;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.ring, ring2Style, { backgroundColor: fill }]} />
      <Animated.View style={[styles.ring, ringStyle, { backgroundColor: fill }]} />
      {/* Скругление обязательно: в браузере тень рисуется по рамке блока — был квадрат. */}
      <Animated.View
        style={[
          aStyle,
          styles.glow,
          { shadowColor: state === 'recording' ? colors.berry : accent.bottom },
        ]}
      >
        <Pressable
          disabled={disabled}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: !!disabled, busy: state === 'recording' }}
          style={[styles.button, { backgroundColor: fill }, disabled && !busy && styles.disabled]}
        >
          {state === 'thinking' ? (
            <TypingDots color={ink} />
          ) : state === 'playing' ? (
            <Icon name="volume-2" size={40} color={ink} strokeWidth={2.5} />
          ) : (
            <Icon name="mic" size={42} color={ink} strokeWidth={2.5} />
          )}
        </Pressable>
      </Animated.View>
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  button: {
    width: 110,
    height: 110,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
});
