/**
 * SplashIntro — app-open animation.
 *
 * The mascot pops in (spring scale + fade), then the "Söz" wordmark slides up
 * from the bottom. Shown once per cold start as a full-screen overlay, then
 * fades out to reveal the app. Uses the child's chosen pet colour. Respects
 * reduce-motion (instant, short hold).
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, scaleFont } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

export function SplashIntro({ onDone }: { onDone: () => void }) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const reduced = useReducedMotion();
  const petHue = useSettings((s) => s.petHue) ?? 55;

  const containerOpacity = useSharedValue(1);
  const petScale = useSharedValue(reduced ? 1 : 0.6);
  const petOpacity = useSharedValue(reduced ? 1 : 0);
  const wordY = useSharedValue(reduced ? 0 : 44);
  const wordOpacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    const hold = reduced ? 700 : 1750;
    if (!reduced) {
      petOpacity.value = withTiming(1, { duration: 380 });
      petScale.value = withSequence(
        withSpring(1.08, { damping: 9, stiffness: 140 }),
        withSpring(1, { damping: 12 }),
      );
      wordOpacity.value = withDelay(480, withTiming(1, { duration: 420 }));
      wordY.value = withDelay(480, withSpring(0, { damping: 14, stiffness: 130 }));
    }
    containerOpacity.value = withDelay(
      hold,
      withTiming(0, { duration: 420 }, (fin) => {
        if (fin) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const petStyle = useAnimatedStyle(() => ({
    opacity: petOpacity.value,
    transform: [{ scale: petScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.abs, cStyle]}>
      <PaperBackground variant="honey">
        <View style={styles.center}>
          <Animated.View style={petStyle}>
            <HBPet size={148} hue={petHue} mood="happy" />
          </Animated.View>
        </View>
        <Animated.View style={[styles.wordWrap, wordStyle]}>
          <Text style={styles.word}>Söz</Text>
          <Text style={styles.tag}>AI dostun · твой AI-друг</Text>
        </Animated.View>
      </PaperBackground>
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  abs: { zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordWrap: { position: 'absolute', bottom: 96, left: 0, right: 0, alignItems: 'center' },
  word: { fontFamily: fontFamily.display, fontSize: scaleFont(56), color: t.c.primary, letterSpacing: -1 },
  tag: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: t.c.inkSoft, marginTop: 4 },
}));
