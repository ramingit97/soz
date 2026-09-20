/**
 * «Приключение» — первый шаг урока малышей в дни квеста.
 *
 * В каждой сцене истории есть волшебное слово из словаря урока: ребёнок говорит
 * его вслух, чтобы идти дальше. Три честные попытки — и можно дальше, промах
 * записывается в отчёт. После последней сцены — игра со словами.
 *
 * Инструкции на языке интерфейса (RU/AZ), история и слово — на изучаемом.
 */

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { LessonHeader } from '@/components/LessonHeader';
import { MicButton } from '@/components/MicButton';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { postWordCheck } from '@/services/api';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { fontFamily, radius, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { kidModeLabel } from '@/utils/lessonModes';
import { makeModeStyles } from '@/theme/modeTokens';

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
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const bot = useCompanionName();
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];

  const [sceneIndex, setSceneIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [heard, setHeard] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const voice = useVoiceRecorder();
  const currentScene = scenes[sceneIndex];
  const keyword = vocabulary[sceneIndex % vocabulary.length] ?? '';
  const isLast = sceneIndex === scenes.length - 1;

  const successScale = useSharedValue(1);
  const failShake = useSharedValue(0);

  useEffect(() => {
    clearLessonErrors();
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
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
    setErrorNote(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatus('recording');
    // Запись останавливается сама, когда ребёнок замолчал.
    await voice.start({ onAutoStop: () => stopRecordingRef.current?.(), silenceMs: 800 });
  }, [permissionGranted, status, voice]);

  const stopRecording = useCallback(async () => {
    if (status !== 'recording') return;
    setStatus('thinking');
    try {
      const audio = await voice.stop();
      if (!audio) { setStatus('idle'); return; }

      const { base64: audioBase64, mimeType: audioMimeType } = audio;

      if (!childId) { setStatus('idle'); return; }

      const result = await postWordCheck(
        childId,
        lang as 'en' | 'ru',
        keyword,
        audioBase64,
        authToken,
        audioMimeType,
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
      // Раньше тут было молчаливое возвращение в ожидание — ребёнок говорил, а
      // экран делал вид, что ничего не было. Не засчитываем как попытку, но
      // говорим, что случилось.
      setErrorNote(
        az ? 'Səsini göndərmək alınmadı. Yenidən cəhd et.' : 'Не получилось отправить запись. Попробуй ещё раз.',
      );
      setStatus('idle');
    }
  }, [status, voice, childId, lang, keyword, authToken, attempts, advance, recordLessonError, az]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  stopRecordingRef.current = () => { void stopRecording(); };

  // Выход без микрофона — только если разрешения нет. Иначе ребёнок пробует
  // сказать слово (строгий режим); застрять нельзя: после трёх попыток дальше.
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
    : status === 'recording' ? 'listening'
    : status === 'thinking' ? 'thinking'
    : 'curious';

  const mode = kidModeLabel('quest', az, bot);

  return (
    <PaperBackground>
      <LessonHeader
        title={mode.name}
        icon={mode.icon}
        step={sceneIndex + 1}
        total={scenes.length}
        right={
          permissionGranted === false ? (
            <HBButton size="sm" variant="ghost" label={az ? 'Növbəti' : 'Дальше'} onPress={skipNoMic} />
          ) : undefined
        }
      />

      {/* Персонаж, сцена и слово прокручиваются, если не влезли, — микрофон и
          подсказка под ними всегда на экране. */}
      <ScrollView
        style={styles.middle}
        contentContainerStyle={[styles.middleContent, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)} style={[styles.petArea, successStyle]}>
          <HBPet size={Math.round(t.mascot.hero * 0.7)} mood={boboMood} />
        </Animated.View>

        <Animated.View key={`scene-${sceneIndex}`} entering={FadeInUp.duration(400)} exiting={FadeOut.duration(160)}>
          <HBCard style={styles.storyCard}>
            <Text style={styles.sceneEmoji}>{currentScene?.emoji ?? ''}</Text>
            <Text variant="headline" style={styles.storyText}>
              {currentScene?.text ?? ''}
            </Text>
          </HBCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(150)}>
          <HBCard bg={accent.soft} style={styles.keywordCard}>
            <Text variant="caption" style={{ color: accent.ink }}>
              {az ? 'Sehrli sözü de:' : 'Скажи волшебное слово:'}
            </Text>
            <Text style={[styles.keywordWord, { color: accent.ink }]}>{keyword.toUpperCase()}</Text>
          </HBCard>
        </Animated.View>
      </ScrollView>

      {/* Что произошло */}
      <View style={[styles.feedbackArea, { paddingHorizontal: t.density.padX }]}>
        {permissionGranted === false ? (
          <InlineBanner
            tone="danger"
            icon="mic-off"
            text={
              az
                ? 'Mikrofon bağlıdır. Telefon ayarlarında icazə ver və ya «Növbəti» düyməsini bas.'
                : 'Микрофон выключен. Разреши его в настройках телефона или нажми «Дальше».'
            }
          />
        ) : status === 'success' ? (
          <Feedback icon="circle-check" color={c.accentDeep} text={az ? `Əla! ${bot} sevinir!` : `Отлично! Ты помог ${bot}!`} />
        ) : status === 'skipped' ? (
          <Feedback icon="arrow-right" color={c.inkSoft} text={az ? 'Heç nə, davam edirik!' : 'Ничего страшного, идём дальше!'} />
        ) : status === 'fail' && heard ? (
          <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={styles.feedbackCol}>
            <Text variant="bodyBold" align="center" style={{ color: c.berryDeep }}>
              {az ? `${bot} eşitdi: «${heard}»` : `${bot} услышал: «${heard}»`}
            </Text>
            <Text variant="caption" tone="secondary" align="center">
              {az ? `Yenidən de: ${keyword}` : `Скажи ещё раз: ${keyword}`}
            </Text>
          </Animated.View>
        ) : errorNote && status === 'idle' ? (
          <InlineBanner tone="danger" text={errorNote} onClose={() => setErrorNote(null)} />
        ) : (
          <Text variant="caption" tone="secondary" align="center">
            {status === 'thinking'
              ? (az ? `${bot} dinləyir…` : `${bot} слушает…`)
              : status === 'recording'
                ? (az ? 'De sözü!' : 'Говори!')
                : (az ? 'Bas və sözü de' : 'Нажми и скажи слово')}
          </Text>
        )}
      </View>

      <View style={styles.micArea}>
        <MicButton
          state={status === 'recording' ? 'recording' : status === 'thinking' ? 'thinking' : 'idle'}
          onPress={() => (status === 'recording' ? stopRecording() : startRecording())}
          disabled={status === 'success' || status === 'skipped' || status === 'thinking' || permissionGranted === false}
          accessibilityLabel={az ? 'Mikrofon' : 'Микрофон'}
        />
      </View>
    </PaperBackground>
  );
}

function Feedback({ icon, color, text }: { icon: 'circle-check' | 'arrow-right'; color: string; text: string }) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.feedbackRow}>
      <Icon name={icon} size={18} color={color} strokeWidth={2.5} />
      <Text variant="bodyBold" style={{ color }}>
        {text}
      </Text>
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[2] },

  petArea: { alignItems: 'center' },

  storyCard: { gap: spacing[2] },
  sceneEmoji: { fontSize: scaleFont(32), lineHeight: scaleFont(40) },
  storyText: { color: t.c.ink },

  keywordCard: { alignItems: 'center', gap: spacing[1], borderRadius: radius.xl },
  keywordWord: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(32),
    lineHeight: scaleFont(40),
    letterSpacing: 3,
  },

  feedbackArea: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  feedbackCol: { alignItems: 'center', gap: 2 },

  micArea: { alignItems: 'center', paddingBottom: spacing[4] },
}));
