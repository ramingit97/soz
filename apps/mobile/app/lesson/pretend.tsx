/**
 * Pretend Play mode — immersive roleplay lesson.
 *
 * The entire lesson is a short scenario (e.g., "You're in a space diner,
 * Bobo is the waiter"). Child speaks freely; Bobo plays along in the
 * target language. After MAX_TURNS exchanges → navigate to word-game.
 */

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { useCompanionName } from '@/utils/companion';
import { alertTalkFailure } from '@/utils/talkAlert';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

interface Turn {
  role: 'child' | 'bobo';
  text: string;
}

const MAX_TURNS = 4; // child turns (not counting Bobo replies)

// Derive a fun scenario from the lesson theme
function getScenario(
  theme: string,
  themeEmoji: string,
  isRu: boolean,
  bot: string,
): { title: string; setup: string; role: string } {
  const scenarios: Record<string, { en: { title: string; setup: string; role: string }; ru: { title: string; setup: string; role: string } }> = {
    default: {
      en: {
        title: `${themeEmoji} Let's Pretend!`,
        setup: `You and ${bot} are on a secret mission about "${theme}"!`,
        role: `${bot} is your adventure partner.`,
      },
      ru: {
        title: `${themeEmoji} Давай играть!`,
        setup: `Ты и ${bot} отправляетесь в приключение на тему "${theme}"!`,
        role: `${bot} — твой напарник по приключениям.`,
      },
    },
  };

  const s = scenarios['default']!;
  return isRu ? s.ru : s.en;
}

export default function PretendScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const isRu = lang === 'ru';

  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const authToken = useSettings((s) => s.authToken);

  const bot = useCompanionName();
  // Низкий экран (iPhone SE, Safari с панелями): иначе микрофон уезжал за край.
  const compact = useWindowDimensions().height < 760;
  const apiLevel = childLevel ?? 'beginner';
  const conversationId = `pretend-${childId}-d${day}-${lang}`;

  const scenario = getScenario(lesson?.theme ?? 'adventure', lesson?.themeEmoji ?? '🎭', isRu, bot);

  const [mood, setMood] = useState<Mood>('idle');
  const [history, setHistory] = useState<Turn[]>([]);
  const [childTurns, setChildTurns] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);

  const voice = useVoiceRecorder();
  const playerRef = useRef<AudioPlayer | null>(null);

  const boboScale = useSharedValue(1);
  useEffect(() => {
    boboScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1200 }), withTiming(1, { duration: 1200 })),
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

  const boboAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boboScale.value }],
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
    if (!permissionGranted || mood !== 'idle' || finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMood('recording');
    // Запись останавливается сама, когда ребёнок замолчал.
    await voice.start({ onAutoStop: () => stopRecordingRef.current?.() });
  }, [permissionGranted, mood, finished, voice]);

  const stopRecording = useCallback(async () => {
    if (mood !== 'recording') return;
    setMood('thinking');
    try {
      const audio = await voice.stop();
      if (!audio) { setMood('idle'); return; }

      const { base64: audioBase64, mimeType: audioMimeType } = audio;

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

      const newTurns = childTurns + 1;
      setChildTurns(newTurns);

      setHistory((prev) => [
        ...prev,
        { role: 'child', text: response.transcript || '...' },
        { role: 'bobo', text: response.responseText },
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (response.audioBase64) {
        setMood('playing');
        await playAudio(response.audioBase64, response.audioMimeType);
      }

      if (newTurns >= MAX_TURNS) {
        setFinished(true);
        setMood('idle');
      } else {
        setMood('idle');
      }
    } catch (e) {
      console.warn('pretend talk failed', e);
      alertTalkFailure(e, bot);
      setMood('idle');
    }
  }, [mood, voice, childId, lang, day, childName, childAgeBand, apiLevel, authToken, childTurns, bot]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  stopRecordingRef.current = () => { void stopRecording(); };

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
  };

  const boboMood = mood === 'playing' ? 'happy' : mood === 'thinking' ? 'thinking' : mood === 'recording' ? 'listening' : 'happy';
  const lastBoboLine = [...history].reverse().find((t) => t.role === 'bobo')?.text;
  const turnProgress = Math.min(childTurns / MAX_TURNS, 1);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1A0A3D', '#2D1B69', '#1F0E4D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Purple sparkle overlay */}
      <View style={styles.sparkleOverlay} />

      <SafeAreaView style={styles.safe}>

        {/* Top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>✕</Text>
          </Pressable>

          <View style={styles.titlePill}>
            <Text style={{ fontSize: 13 }}>🎭</Text>
            <Text style={styles.titleText}>{isRu ? 'Ролевая игра' : 'Pretend Play'}</Text>
          </View>

          <Pressable onPress={handleFinish} style={styles.finishBtn}>
            <Text style={styles.finishText}>{isRu ? 'Готово' : 'Done'}</Text>
          </Pressable>
        </Animated.View>

        {/* Turn progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${turnProgress * 100}%` }]} />
        </View>

        {/* Прокручивается, если не влезло, — статус и микрофон всегда на экране. */}
        <ScrollView
          style={styles.middle}
          contentContainerStyle={styles.middleContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Scenario card */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.scenarioArea}>
          <View style={[styles.scenarioCard, shadow.md]}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioSetup}>{scenario.setup}</Text>
            <Text style={styles.scenarioRole}>{scenario.role}</Text>
          </View>
        </Animated.View>

        {/* Bobo */}
        <View style={styles.boboArea}>
          <Animated.View style={boboAnimStyle}>
            <View style={styles.boboGlow}>
              <Bobo size={compact ? 72 : 100} mood={boboMood} />
            </View>
          </Animated.View>
        </View>

        {/* Latest Bobo line */}
        <Animated.View
          key={lastBoboLine ?? 'empty'}
          entering={FadeInUp.duration(350)}
          style={styles.speechBubbleArea}
        >
          {lastBoboLine ? (
            <View style={[styles.speechBubble, shadow.sm]}>
              <Text style={styles.speechText}>{lastBoboLine}</Text>
            </View>
          ) : (
            <View style={[styles.speechBubble, shadow.sm]}>
              <Text style={[styles.speechText, { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }]}>
                {isRu ? 'Начни говорить!' : 'Start talking!'}
              </Text>
            </View>
          )}
        </Animated.View>
        </ScrollView>

        {/* Status / finish */}
        <View style={styles.statusArea}>
          {finished ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <Pressable style={styles.continueButton} onPress={handleFinish}>
                <Text style={styles.continueText}>
                  {isRu ? '✨ Продолжить урок' : '✨ Continue lesson'}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Text style={styles.statusHint}>
              {mood === 'thinking'
                ? (isRu ? `${bot} думает...` : `${bot} is thinking...`)
                : mood === 'playing'
                  ? (isRu ? `${bot} говорит...` : `${bot} is speaking...`)
                  : mood === 'recording'
                    ? (isRu ? '🔴 Слушаю...' : '🔴 Listening...')
                    : (isRu ? `Ход ${childTurns + 1} из ${MAX_TURNS}` : `Turn ${childTurns + 1} of ${MAX_TURNS}`)}
            </Text>
          )}
        </View>

        {/* Mic */}
        {!finished && (
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.micArea}>
            <MicButton
              state={mood === 'recording' ? 'recording' : mood === 'thinking' || mood === 'playing' ? 'thinking' : 'idle'}
              onPress={() => (mood === 'recording' ? stopRecording() : startRecording())}
              disabled={mood === 'thinking' || mood === 'playing' || !permissionGranted}
            />
          </Animated.View>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A0A3D' },
  safe: { flex: 1 },
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center' },
  sparkleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  titleText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
  },
  finishBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  finishText: {
    color: 'rgba(167, 139, 250, 0.8)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },

  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing[5],
    marginVertical: spacing[2],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(167, 139, 250, 0.8)',
    borderRadius: 2,
  },

  scenarioArea: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
  },
  scenarioCard: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    padding: spacing[4],
    gap: spacing[1],
  },
  scenarioTitle: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  scenarioSetup: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  scenarioRole: {
    color: 'rgba(167, 139, 250, 0.8)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing[1],
  },

  boboArea: {
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  boboGlow: {
    padding: spacing[3],
    borderRadius: radius.full,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
  },

  speechBubbleArea: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  speechBubble: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing[4],
    minHeight: 60,
    justifyContent: 'center',
  },
  speechText: {
    color: colors.cream,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: 24,
    textAlign: 'center',
  },

  statusArea: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  statusHint: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  continueText: {
    color: colors.white,
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    textAlign: 'center',
  },

  micArea: {
    alignItems: 'center',
    paddingBottom: spacing[8],
    marginTop: spacing[1],
  },
});
