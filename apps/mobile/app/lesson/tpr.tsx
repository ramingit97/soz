/**
 * TPR mode — Total Physical Response.
 *
 * Bobo gives a physical action command tied to each vocabulary word.
 * Child performs the action, then taps "Done!" to advance.
 * On the final word → navigate to word-game.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

type Status = 'idle' | 'doing' | 'done';

const ACTIONS_EN = [
  { action: 'Jump and say', emoji: '🦘' },
  { action: 'Clap and say', emoji: '👏' },
  { action: 'Spin around and shout', emoji: '🌀' },
  { action: 'Touch your nose and say', emoji: '👃' },
  { action: 'Wave both hands and say', emoji: '👋' },
  { action: 'Stomp your feet and say', emoji: '🦶' },
  { action: 'Reach for the sky and say', emoji: '🙌' },
  { action: 'Do a silly dance and say', emoji: '🕺' },
];

const ACTIONS_RU = [
  { action: 'Прыгни и скажи', emoji: '🦘' },
  { action: 'Похлопай и скажи', emoji: '👏' },
  { action: 'Покружись и крикни', emoji: '🌀' },
  { action: 'Потрогай нос и скажи', emoji: '👃' },
  { action: 'Помаши руками и скажи', emoji: '👋' },
  { action: 'Потопай и скажи', emoji: '🦶' },
  { action: 'Потянись вверх и скажи', emoji: '🙌' },
  { action: 'Потанцуй и скажи', emoji: '🕺' },
];

export default function TPRScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const vocabulary = lesson?.vocabulary ?? [];
  const isRu = lang === 'ru';
  const actions = isRu ? ACTIONS_RU : ACTIONS_EN;

  const [wordIndex, setWordIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');

  const isLast = wordIndex === vocabulary.length - 1;
  const currentWord = vocabulary[wordIndex] ?? '';
  const currentAction = actions[wordIndex % actions.length];

  const boboScale = useSharedValue(1);
  const boboY = useSharedValue(0);
  const starBurst = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  // Bobo idle pulse
  useEffect(() => {
    boboScale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true,
    );
  }, []);

  // On word change: reset status + play Bobo bounce
  useEffect(() => {
    setStatus('idle');
    boboY.value = withSequence(
      withTiming(-18, { duration: 220 }),
      withSpring(0, { damping: 5 }),
    );
  }, [wordIndex]);

  const advance = useCallback(() => {
    if (isLast) {
      router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
    } else {
      setWordIndex((i) => i + 1);
    }
  }, [isLast, lang, day]);

  const handleDone = useCallback(() => {
    if (status !== 'idle') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Bobo jump celebration
    boboY.value = withSequence(
      withTiming(-30, { duration: 200 }),
      withSpring(0, { damping: 4 }),
    );
    buttonScale.value = withSequence(withSpring(0.92), withDelay(120, withSpring(1)));
    starBurst.value = withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 200 }));

    setStatus('done');
    setTimeout(advance, 900);
  }, [status, advance]);

  const boboAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boboScale.value }, { translateY: boboY.value }],
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const skipWord = () => {
    Haptics.selectionAsync().catch(() => {});
    advance();
  };

  const boboMood = status === 'done' ? 'happy' : 'curious';

  const bot = useCompanionName();
  const doneLabel = isRu ? 'Я сделал! 🎉' : 'I did it! 🎉';
  const boboSaysLabel = isRu ? `${bot} говорит:` : `${bot} says:`;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FF8C00', '#FF5F1F', '#E63946']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Overlay to soften gradient */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>✕</Text>
          </Pressable>

          <View style={styles.titlePill}>
            <Text style={{ fontSize: 14 }}>⚡</Text>
            <Text style={styles.titleText}>
              {isRu ? `Двигайся с ${bot}!` : `Move with ${bot}!`}
            </Text>
          </View>

          <Pressable onPress={skipWord} style={styles.skipBtn}>
            <Text style={styles.skipText}>{isRu ? 'Пропустить' : 'Skip'}</Text>
          </Pressable>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {vocabulary.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === wordIndex && styles.dotActive,
                i < wordIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>

        {/* Bobo */}
        <View style={styles.boboArea}>
          <Animated.View style={boboAnimStyle}>
            <Bobo size={120} mood={boboMood} />
          </Animated.View>
        </View>

        {/* Command card */}
        <Animated.View
          key={`cmd-${wordIndex}`}
          entering={FadeInDown.duration(400)}
          exiting={FadeOut.duration(180)}
          style={styles.cardArea}
        >
          <View style={[styles.commandCard, shadow.lg]}>
            <Text style={styles.boboSays}>{boboSaysLabel}</Text>

            <Text style={styles.actionEmoji}>{currentAction?.emoji ?? '⚡'}</Text>

            <Text style={styles.actionText}>
              {currentAction?.action}
            </Text>

            <View style={styles.wordBubble}>
              <Text style={styles.wordText}>{currentWord.toUpperCase()}</Text>
            </View>
          </View>
        </Animated.View>

        {/* "I did it!" button */}
        <View style={styles.buttonArea}>
          {status === 'done' ? (
            <Animated.View entering={FadeIn.duration(250)}>
              <Text style={styles.celebrateText}>
                {isRu ? '🌟 Потрясающе!' : '🌟 Amazing!'}
              </Text>
            </Animated.View>
          ) : (
            <Animated.View style={buttonAnimStyle} entering={FadeInUp.duration(400).delay(200)}>
              <Pressable
                style={styles.doneButton}
                onPress={handleDone}
                android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
              >
                <Text style={styles.doneButtonText}>{doneLabel}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        {/* Hint text */}
        <Animated.View entering={FadeInUp.duration(400).delay(350)} style={styles.hintArea}>
          <Text style={styles.hintText}>
            {isRu
              ? `Выполни задание, потом нажми кнопку`
              : `Do the action, then tap the button`}
          </Text>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF5F1F' },
  safe: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  titleText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 24,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  boboArea: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },

  cardArea: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  commandCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  boboSays: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    letterSpacing: 0.5,
  },
  actionEmoji: {
    fontSize: fontSize['5xl'],
    lineHeight: 60,
  },
  actionText: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    textAlign: 'center',
    lineHeight: 32,
  },
  wordBubble: {
    marginTop: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  wordText: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    letterSpacing: 5,
    textAlign: 'center',
  },

  buttonArea: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    marginBottom: spacing[3],
  },
  doneButton: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[10],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  doneButtonText: {
    color: '#FF5F1F',
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    letterSpacing: 0.5,
  },
  celebrateText: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },

  hintArea: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
