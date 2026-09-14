/**
 * Quest mode — replaces the passive "listen" story screen.
 *
 * Each story scene has a magic word the child must SAY to advance.
 * The keyword is drawn from the lesson's vocabulary list.
 * On the final scene → navigate to word-game (same as listen.tsx).
 */

import * as FileSystem from 'expo-file-system/legacy';
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
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { Bobo } from '@/components/Bobo';
import { MicButton } from '@/components/MicButton';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { postWordCheck } from '@/services/api';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

type Status = 'idle' | 'recording' | 'thinking' | 'success' | 'fail' | 'skipped';

const MAX_ATTEMPTS = 3; // after 3 failures, let child advance

export default function QuestScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const scenes = lesson?.story ?? [];
  const vocabulary = lesson?.vocabulary ?? [];
  const clearLessonErrors = useSettings((s) => s.clearLessonErrors);
  const recordLessonError = useSettings((s) => s.recordLessonError);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const isRu = lang === 'ru';

  const [sceneIndex, setSceneIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [heard, setHeard] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const currentScene = scenes[sceneIndex];
  const keyword = vocabulary[sceneIndex % vocabulary.length] ?? '';
  const isLast = sceneIndex === scenes.length - 1;

  const successScale = useSharedValue(1);
  const failShake = useSharedValue(0);
  const starOpacity1 = useSharedValue(0.4);
  const starOpacity2 = useSharedValue(0.7);

  useEffect(() => {
    clearLessonErrors();
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
    // Twinkle stars
    starOpacity1.value = withSequence(
      withTiming(1, { duration: 2000 }),
      withTiming(0.3, { duration: 2000 }),
    );
  }, []);

  useEffect(() => {
    // Reset feedback state on scene change
    setStatus('idle');
    setHeard(null);
    setAttempts(0);
  }, [sceneIndex]);

  const advance = useCallback(() => {
    if (isLast) {
      router.push(`/lesson/word-game?lang=${lang}&day=${day}`);
    } else {
      setSceneIndex((i) => i + 1);
    }
  }, [isLast, lang, day]);

  const startRecording = useCallback(async () => {
    if (!permissionGranted || status !== 'idle') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStatus('recording');
  }, [permissionGranted, status, recorder]);

  const stopRecording = useCallback(async () => {
    if (status !== 'recording') return;
    setStatus('thinking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setStatus('idle'); return; }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!childId) { setStatus('idle'); return; }

      const result = await postWordCheck(
        childId,
        lang as 'en' | 'ru',
        keyword,
        audioBase64,
        authToken,
      );

      setHeard(result.heard || '...');

      if (result.matched) {
        setStatus('success');
        playSfx('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        successScale.value = withSequence(
          withSpring(1.15, { damping: 6 }),
          withDelay(800, withSpring(1)),
        );
        setTimeout(advance, 1400);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          // Honest attempts exhausted — let the child move on, but RECORD the miss
          // so it surfaces in the parent report, review queue, and AI analysis
          // (instead of silently counting as a perfect lesson).
          recordLessonError({
            kind: 'pronunciation',
            prompt: keyword,
            correct: keyword,
            given: result.heard || '',
          });
          setStatus('skipped');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          setTimeout(advance, 2000);
        } else {
          setStatus('fail');
          playSfx('error', 0.5);
          failShake.value = withSequence(
            withTiming(-4, { duration: 70 }),
            withTiming(4, { duration: 70 }),
            withTiming(-3, { duration: 70 }),
            withTiming(0, { duration: 70 }),
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setTimeout(() => setStatus('idle'), 2200);
        }
      }
    } catch {
      setStatus('idle');
    }
  }, [status, recorder, childId, lang, keyword, authToken, attempts, advance, recordLessonError]);

  // Escape hatch only when the mic is unavailable (permission denied) — otherwise
  // the child must actually attempt the word (strict mode). They are never trapped:
  // 3 honest tries auto-advances (and records the miss).
  const skipNoMic = () => {
    Haptics.selectionAsync().catch(() => {});
    advance();
  };

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }, { rotate: `${failShake.value}deg` }],
  }));

  const boboMood =
    status === 'success' || status === 'skipped' ? 'happy'
    : status === 'fail' ? 'sad'
    : status === 'recording' ? 'curious'
    : 'sleepy';

  const bot = useCompanionName();
  const questIntro = isRu
    ? `Миссия ${sceneIndex + 1}: помоги ${bot}!`
    : `Quest ${sceneIndex + 1}: help ${bot}!`;

  const keywordLabel = isRu ? 'Скажи волшебное слово:' : 'Say the magic word:';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0F0A24', '#1A1040', '#1C1845']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient star dots */}
      <Animated.View style={[styles.star, { top: 70, left: 24 }]}>
        <Text style={[styles.starGlyph, { fontSize: 14 }]}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.star, { top: 130, right: 40 }]}>
        <Text style={[styles.starGlyph, { fontSize: 8 }]}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.star, { top: 220, left: 60 }]}>
        <Text style={[styles.starGlyph, { fontSize: 11 }]}>✦</Text>
      </Animated.View>
      <Animated.View style={[styles.star, { top: 50, right: 90 }]}>
        <Text style={[styles.starGlyph, { fontSize: 7 }]}>✦</Text>
      </Animated.View>

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </Pressable>

          <View style={styles.questPill}>
            <Text style={{ fontSize: 14 }}>🗺️</Text>
            <Text style={styles.questPillText}>{questIntro}</Text>
          </View>

          {/* No free skip in strict mode — only an escape when the mic can't be used */}
          {permissionGranted === false ? (
            <Pressable onPress={skipNoMic} style={styles.skipBtn}>
              <Text style={styles.skipText}>{isRu ? 'Дальше' : 'Next'}</Text>
            </Pressable>
          ) : (
            <View style={styles.skipBtn} />
          )}
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
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

        {/* Bobo + story card */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.boboArea}>
          <Animated.View style={successStyle}>
            <View style={styles.boboGlow}>
              <Bobo size={110} mood={boboMood} />
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View
          key={`scene-${sceneIndex}`}
          entering={FadeInUp.duration(450)}
          exiting={FadeOut.duration(180)}
          style={styles.cardArea}
        >
          <View style={[styles.storyCard, shadow.lg]}>
            <Text style={{ fontSize: scaleFont(34), marginBottom: spacing[3] }}>
              {currentScene?.emoji ?? '📖'}
            </Text>
            <Text style={styles.storyText}>
              {currentScene?.text ?? ''}
            </Text>
          </View>
        </Animated.View>

        {/* Keyword prompt */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.keywordArea}>
          <View style={styles.keywordCard}>
            <Text style={styles.keywordLabel}>{keywordLabel}</Text>
            <Text style={styles.keywordWord}>{keyword.toUpperCase()}</Text>
          </View>
        </Animated.View>

        {/* Feedback */}
        <View style={styles.feedbackArea}>
          {status === 'success' && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.feedbackSuccess}>
                {isRu ? `✨ Отлично! Ты помог ${bot}!` : `✨ Amazing! You helped ${bot}!`}
              </Text>
            </Animated.View>
          )}
          {status === 'skipped' && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.feedbackSkip}>
                {isRu ? '👍 Ничего страшного, двигаемся дальше!' : "👍 No worries, moving on!"}
              </Text>
            </Animated.View>
          )}
          {status === 'fail' && heard && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
              <Text style={styles.feedbackFail}>
                {isRu
                  ? `Бобо услышал: «${heard}». Попробуй ещё раз!`
                  : `Bobo heard: "${heard}". Try again!`}
              </Text>
              <Text style={styles.feedbackHint}>
                {isRu ? `Скажи: ${keyword}` : `Say: ${keyword}`}
              </Text>
            </Animated.View>
          )}
          {status === 'idle' && (
            <Text style={styles.holdHint}>
              {isRu ? '🎤 Зажми и скажи слово' : '🎤 Hold and say the word'}
            </Text>
          )}
          {status === 'thinking' && (
            <Text style={styles.holdHint}>
              {isRu ? 'Бобо слушает...' : 'Bobo is listening...'}
            </Text>
          )}
        </View>

        {/* Mic button */}
        <View style={styles.micArea}>
          <MicButton
            state={status === 'recording' ? 'recording' : status === 'thinking' ? 'thinking' : 'idle'}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={status === 'success' || status === 'skipped' || status === 'thinking'}
          />
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  questPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
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

  boboArea: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  boboGlow: {
    padding: spacing[3],
    borderRadius: radius.full,
    backgroundColor: 'rgba(124, 92, 255, 0.18)',
  },

  cardArea: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing[5],
    minHeight: 130,
    justifyContent: 'center',
  },
  storyText: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(22),
    color: colors.cream,
    lineHeight: 32,
    letterSpacing: -0.2,
  },

  keywordArea: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  keywordCard: {
    backgroundColor: 'rgba(124, 92, 255, 0.22)',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    gap: spacing[1],
  },
  keywordLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  keywordWord: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: scaleFont(34),
    letterSpacing: 4,
  },

  feedbackArea: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
  },
  feedbackSuccess: {
    color: colors.accent,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  feedbackSkip: {
    color: colors.accentYellow,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  feedbackFail: {
    color: colors.accentPink,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  feedbackHint: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  holdHint: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  micArea: {
    alignItems: 'center',
    paddingBottom: spacing[8],
  },

  star: { position: 'absolute' },
  starGlyph: { color: 'rgba(255,255,255,0.5)' },
});
