/**
 * "Show Bobo your world" mode.
 *
 * Bobo prompts the child to describe real objects around them using
 * today's vocabulary. The child speaks freely, Bobo reacts and encourages.
 * After MAX_PROMPTS prompts → navigate to word-game.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { readAsBase64 } from '@/utils/recording';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { MicButton } from '@/components/MicButton';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { postTalk } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

const MAX_PROMPTS = 3;

// World prompts tied to vocabulary word
function getWorldPrompt(word: string, isRu: boolean): { prompt: string; emoji: string } {
  const templates_en = [
    { prompt: `Find something ${word} near you and describe it!`, emoji: '👀' },
    { prompt: `Can you see anything related to "${word}"? Tell Bobo!`, emoji: '🔍' },
    { prompt: `Look around — what reminds you of "${word}"?`, emoji: '🌍' },
    { prompt: `Show Bobo something "${word}" in your world!`, emoji: '✨' },
    { prompt: `Describe something you can see that's like "${word}"!`, emoji: '🎯' },
  ];
  const templates_ru = [
    { prompt: `Найди что-нибудь "${word}" рядом и опиши!`, emoji: '👀' },
    { prompt: `Видишь что-то связанное с "${word}"? Расскажи Бобо!`, emoji: '🔍' },
    { prompt: `Посмотри вокруг — что напоминает тебе "${word}"?`, emoji: '🌍' },
    { prompt: `Покажи Бобо что-нибудь "${word}" в твоём мире!`, emoji: '✨' },
    { prompt: `Опиши что-нибудь похожее на "${word}"!`, emoji: '🎯' },
  ];

  const templates = isRu ? templates_ru : templates_en;
  const idx = Math.abs(word.charCodeAt(0)) % templates.length;
  return (templates[idx] ?? templates[0])!;
}

export default function WorldScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const vocabulary = lesson?.vocabulary ?? [];
  const isRu = lang === 'ru';

  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const authToken = useSettings((s) => s.authToken);

  const apiLevel = childLevel ?? 'beginner';
  const conversationId = `world-${childId}-d${day}-${lang}`;

  const [promptIndex, setPromptIndex] = useState(0);
  const [mood, setMood] = useState<Mood>('idle');
  const [boboReply, setBoboReply] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playerRef = useRef<AudioPlayer | null>(null);

  const currentWord = vocabulary[promptIndex % vocabulary.length] ?? '';
  const currentPrompt = getWorldPrompt(currentWord, isRu);
  const isLast = promptIndex >= MAX_PROMPTS - 1;

  // Camera-lens "focus" animation for scan effect
  const scanScale = useSharedValue(0.95);
  useEffect(() => {
    scanScale.value = withRepeat(
      withSequence(withTiming(1.02, { duration: 2500 }), withTiming(0.95, { duration: 2500 })),
      -1,
      true,
    );
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
    return () => {
      try { playerRef.current?.pause(); } catch { /* released */ }
      playerRef.current?.remove();
    };
  }, []);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanScale.value }],
  }));

  const playAudio = async (base64: string, mimeType: string) => {
    try {
      try { playerRef.current?.pause(); } catch { /* released */ }
      playerRef.current?.remove();
      const player = createAudioPlayer({ uri: `data:${mimeType};base64,${base64}` });
      playerRef.current = player;
      player.play();
      await new Promise<void>((resolve) => {
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) { sub.remove(); resolve(); }
        });
      });
      player.remove();
      playerRef.current = null;
    } catch { /* ignore */ }
  };

  const startRecording = useCallback(async () => {
    if (!permissionGranted || mood !== 'idle' || done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await recorder.prepareToRecordAsync();
    recorder.record();
    setMood('recording');
  }, [permissionGranted, mood, done, recorder]);

  const stopRecording = useCallback(async () => {
    if (mood !== 'recording') return;
    setMood('thinking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setMood('idle'); return; }

      const { base64: audioBase64, mimeType: audioMimeType } = await readAsBase64(uri);

      if (!childId) { setMood('idle'); return; }

      const response = await postTalk({
        childId,
        conversationId,
        language: lang as 'en' | 'ru',
        audioBase64,
        audioMimeType,
        level: apiLevel,
        day: Number(day),
        childName: childName ?? undefined,
        ageBand: childAgeBand ?? undefined,
      }, authToken);

      setBoboReply(response.responseText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (response.audioBase64) {
        setMood('playing');
        await playAudio(response.audioBase64, response.audioMimeType);
      }

      if (isLast) {
        setDone(true);
        setMood('idle');
      } else {
        setMood('idle');
        // Auto-advance to next prompt after short pause
        setTimeout(() => {
          setBoboReply(null);
          setPromptIndex((i) => i + 1);
        }, 1500);
      }
    } catch {
      setMood('idle');
    }
  }, [mood, recorder, childId, lang, day, childName, childAgeBand, apiLevel, authToken, isLast]);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
  };

  const skipPrompt = () => {
    Haptics.selectionAsync().catch(() => {});
    if (isLast) { setDone(true); } else { setPromptIndex((i) => i + 1); setBoboReply(null); }
  };

  const boboMood = mood === 'playing' ? 'happy' : mood === 'recording' ? 'curious' : 'happy';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D2B1A', '#0F4C2A', '#163D22']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </Pressable>

          <View style={styles.titlePill}>
            <Text style={{ fontSize: 14 }}>🌍</Text>
            <Text style={styles.titleText}>
              {isRu ? 'Покажи Бобо мир!' : 'Show Bobo your world!'}
            </Text>
          </View>

          <Pressable onPress={skipPrompt} style={styles.skipBtn}>
            <Text style={styles.skipText}>{isRu ? 'Дальше' : 'Next'}</Text>
          </Pressable>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {Array.from({ length: MAX_PROMPTS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === promptIndex && styles.dotActive,
                i < promptIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>

        {/* Bobo */}
        <View style={styles.boboArea}>
          <Bobo size={110} mood={boboMood} />
        </View>

        {/* Prompt card */}
        {!done && (
          <Animated.View
            key={`prompt-${promptIndex}`}
            entering={FadeInDown.duration(400)}
            exiting={FadeOut.duration(150)}
            style={styles.promptArea}
          >
            <Animated.View style={[styles.scanFrame, scanStyle]}>
              <View style={[styles.promptCard, shadow.lg]}>
                <Text style={styles.promptEmoji}>{currentPrompt.emoji}</Text>
                <Text style={styles.promptText}>{currentPrompt.prompt}</Text>
                <View style={styles.wordTag}>
                  <Text style={styles.wordTagText}>{currentWord.toUpperCase()}</Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {/* Bobo reply bubble */}
        {boboReply && !done && (
          <Animated.View
            key={boboReply}
            entering={FadeInUp.duration(300)}
            exiting={FadeOut.duration(150)}
            style={styles.replyArea}
          >
            <View style={styles.replyBubble}>
              <Text style={styles.replyText}>{boboReply}</Text>
            </View>
          </Animated.View>
        )}

        {/* Done state */}
        {done && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.doneArea}>
            <Text style={styles.doneEmoji}>🌟</Text>
            <Text style={styles.doneTitle}>
              {isRu ? 'Бобо увидел твой мир!' : "Bobo saw your world!"}
            </Text>
            <Pressable style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueText}>
                {isRu ? 'Продолжить урок →' : 'Continue lesson →'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Status hint */}
        {!done && (
          <View style={styles.hintArea}>
            <Text style={styles.hintText}>
              {mood === 'thinking'
                ? (isRu ? 'Бобо слушает...' : 'Bobo is listening...')
                : mood === 'playing'
                  ? (isRu ? 'Бобо отвечает...' : 'Bobo is responding...')
                  : mood === 'recording'
                    ? (isRu ? '🔴 Слушаю!' : '🔴 Go ahead!')
                    : (isRu ? '🎤 Зажми и расскажи' : '🎤 Hold and describe')}
            </Text>
          </View>
        )}

        {/* Mic */}
        {!done && (
          <Animated.View entering={FadeInUp.duration(400).delay(250)} style={styles.micArea}>
            <MicButton
              state={mood === 'recording' ? 'recording' : mood === 'thinking' || mood === 'playing' ? 'thinking' : 'idle'}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={mood === 'thinking' || mood === 'playing' || !permissionGranted}
            />
          </Animated.View>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D2B1A' },
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
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  titleText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },
  skipBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  skipText: {
    color: 'rgba(52, 211, 153, 0.7)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.9)',
    width: 28,
    borderRadius: 5,
  },
  dotDone: {
    backgroundColor: 'rgba(52, 211, 153, 0.5)',
  },

  boboArea: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },

  promptArea: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  scanFrame: {
    borderRadius: radius['2xl'],
  },
  promptCard: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[2],
  },
  promptEmoji: {
    fontSize: scaleFont(40),
    lineHeight: 50,
  },
  promptText: {
    color: colors.cream,
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    textAlign: 'center',
    lineHeight: 28,
  },
  wordTag: {
    marginTop: spacing[1],
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  wordTagText: {
    color: 'rgba(52, 211, 153, 0.95)',
    fontFamily: fontFamily.display,
    fontSize: scaleFont(22),
    letterSpacing: 4,
  },

  replyArea: {
    paddingHorizontal: spacing[6],
    marginBottom: spacing[2],
  },
  replyBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing[4],
  },
  replyText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  doneArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
  },
  doneEmoji: { fontSize: 60 },
  doneTitle: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.5)',
  },
  continueText: {
    color: 'rgba(52, 211, 153, 0.95)',
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    textAlign: 'center',
  },

  hintArea: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  hintText: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  micArea: {
    alignItems: 'center',
    paddingBottom: spacing[8],
  },
});
