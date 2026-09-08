import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

const CHAR_DELAY = 35; // ms per character for typewriter

export default function ListenScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const scenes = lesson?.story ?? [];
  const clearLessonErrors = useSettings((s) => s.clearLessonErrors);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [textComplete, setTextComplete] = useState(false);

  // Lesson starts here — reset error tracking
  useEffect(() => {
    clearLessonErrors();
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentScene = scenes[sceneIndex];

  // Star decorations
  const starOpacity1 = useSharedValue(0.4);
  const starOpacity2 = useSharedValue(0.7);
  useEffect(() => {
    starOpacity1.value = withRepeat(
      withSequence(withTiming(1, { duration: 2000 }), withTiming(0.3, { duration: 2000 })),
      -1, true
    );
    starOpacity2.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 3200 }), withTiming(1, { duration: 3200 })),
      -1, true
    );
  }, []);

  // Typewriter effect on each scene change
  useEffect(() => {
    if (!currentScene) return;
    setDisplayedText('');
    setTextComplete(false);
    if (timerRef.current) clearInterval(timerRef.current);

    let i = 0;
    const fullText = currentScene.text;
    timerRef.current = setInterval(() => {
      i++;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(timerRef.current!);
        setTextComplete(true);
      }
    }, CHAR_DELAY);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sceneIndex]);

  const skipToFull = () => {
    if (!currentScene || textComplete) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayedText(currentScene.text);
    setTextComplete(true);
  };

  const handleNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((i) => i + 1);
    } else {
      router.push(`/lesson/word-game?lang=${lang}&day=${day}`);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const isLast = sceneIndex === scenes.length - 1;
  const isRu = lang === 'ru';

  return (
    <View style={styles.root}>
      {/* Deep night-sky gradient */}
      <LinearGradient
        colors={['#0F0A24', '#1E1140', '#2D1F5C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative star dots */}
      <Animated.View style={[styles.starDot, { top: 80, left: 30 }, { opacity: starOpacity1 }]}>
        <Text style={{ fontSize: 16 }}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.starDot, { top: 120, right: 50 }, { opacity: starOpacity2 }]}>
        <Text style={{ fontSize: 10 }}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.starDot, { top: 200, left: 70 }, { opacity: starOpacity1 }]}>
        <Text style={{ fontSize: fontSize.xs }}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.starDot, { top: 60, right: 100 }, { opacity: starOpacity2 }]}>
        <Text style={{ fontSize: 8 }}>✦</Text>
      </Animated.View>

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </Pressable>

          <View style={styles.scenePill}>
            <Text style={{ fontSize: 14 }}>🎧</Text>
            <Text style={styles.scenePillText}>
              {sceneIndex + 1} / {scenes.length}
            </Text>
          </View>

          <View style={{ width: 44 }} />
        </Animated.View>

        {/* Bobo */}
        <Animated.View entering={FadeInDown.duration(700)} style={styles.boboWrap}>
          <View style={styles.boboGlow}>
            <Bobo size={140} mood="curious" />
          </View>
        </Animated.View>

        {/* Story text card */}
        <Animated.View
          key={`scene-${sceneIndex}`}
          entering={FadeInUp.duration(500)}
          exiting={FadeOut.duration(200)}
          style={styles.cardArea}
        >
          <Pressable onPress={skipToFull}>
            <View style={[styles.textCard, shadow.lg]}>
              {/* Scene emoji */}
              <View style={styles.sceneEmoji}>
                <Text style={{ fontSize: 32 }}>{currentScene?.emoji ?? '📖'}</Text>
              </View>

              {/* Typewriter text */}
              <Text style={styles.storyText}>
                {displayedText}
                {!textComplete && (
                  <Text style={{ color: colors.primary }}>|</Text>
                )}
              </Text>

              {!textComplete && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.tapHint}>
                  <Text style={styles.tapHintText}>
                    {isRu ? 'Нажми чтобы пропустить' : 'Tap to skip'}
                  </Text>
                </Animated.View>
              )}
            </View>
          </Pressable>

          {/* Scene dots */}
          <View style={styles.dotsRow}>
            {scenes.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === sceneIndex && styles.dotActive,
                  i < sceneIndex && styles.dotDone,
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* Next button — only shows when text is complete */}
        <View style={styles.bottomArea}>
          {textComplete ? (
            <Animated.View entering={FadeInUp.duration(400)}>
              <Pressable
                onPress={handleNext}
                style={styles.nextBtn}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextBtnGradient}
                >
                  <Text style={styles.nextBtnText}>
                    {isLast
                      ? (isRu ? 'Понял! Играть в слова 🎮' : "Got it! Word game 🎮")
                      : (isRu ? 'Дальше →' : 'Next →')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.nextBtnPlaceholder} />
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0A24' },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  scenePillText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },

  boboWrap: {
    alignItems: 'center',
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  boboGlow: {
    padding: spacing[4],
    borderRadius: radius.full,
    backgroundColor: 'rgba(124, 92, 255, 0.2)',
  },

  cardArea: {
    flex: 1,
    paddingHorizontal: spacing[5],
    justifyContent: 'center',
  },
  textCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: spacing[6],
    minHeight: 180,
    justifyContent: 'center',
  },
  sceneEmoji: {
    marginBottom: spacing[3],
  },
  storyText: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.cream,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  tapHint: {
    marginTop: spacing[4],
  },
  tapHintText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.35)',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[5],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: colors.accent,
  },

  bottomArea: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    paddingTop: spacing[3],
  },
  nextBtn: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  nextBtnGradient: {
    paddingVertical: spacing[4],
    alignItems: 'center',
    borderRadius: radius.full,
  },
  nextBtnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
    letterSpacing: 0.3,
  },
  nextBtnPlaceholder: {
    height: 56,
  },

  starDot: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.6)',
  },
});
