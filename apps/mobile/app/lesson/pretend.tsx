/**
 * Ролевая игра — короткий сюжет вокруг темы урока: ребёнок говорит свободно,
 * персонаж подыгрывает на изучаемом языке. После MAX_TURNS реплик — игра со
 * словами. Сюжет и подсказки на языке интерфейса (RU/AZ).
 */

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestRecordingPermissionsAsync, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { InlineBanner } from '@/components/InlineBanner';
import { LessonHeader } from '@/components/LessonHeader';
import { MicButton } from '@/components/MicButton';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { postTalk } from '@/services/api';
import { playReplyAudio, stopReplyAudio } from '@/services/replyAudio';
import { useSettings } from '@/store/settings';
import { scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { kidModeLabel } from '@/utils/lessonModes';
import { talkFailureMessage, type TalkFailureMessage } from '@/utils/talkAlert';
import { makeModeStyles } from '@/theme/modeTokens';

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

const MAX_TURNS = 4; // реплики ребёнка (ответы персонажа не считаются)

export default function PretendScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const bot = useCompanionName();
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];

  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const authToken = useSettings((s) => s.authToken);

  const apiLevel = childLevel ?? 'beginner';
  const conversationId = `pretend-${childId}-d${day}-${lang}`;
  const theme = lesson?.theme ?? (az ? 'macəra' : 'приключение');

  const [mood, setMood] = useState<Mood>('idle');
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [childTurns, setChildTurns] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [failure, setFailure] = useState<TalkFailureMessage | null>(null);

  const voice = useVoiceRecorder();
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
    return () => stopReplyAudio(playerRef);
  }, []);

  const startRecording = useCallback(async () => {
    if (!permissionGranted || mood !== 'idle' || finished) return;
    setFailure(null);
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
      if (!childId) { setMood('idle'); return; }

      const response = await postTalk({
        childId,
        conversationId,
        language: lang as 'en' | 'ru',
        audioBase64: audio.base64,
        audioMimeType: audio.mimeType,
        level: apiLevel,
        day: Number(day),
        childName: childName ?? undefined,
        ageBand: childAgeBand ?? undefined,
      }, authToken);

      const newTurns = childTurns + 1;
      setChildTurns(newTurns);
      setLastReply(response.responseText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (response.audioBase64) {
        setMood('playing');
        await playReplyAudio(playerRef, response.audioBase64, response.audioMimeType, 'pretend');
      }
      if (newTurns >= MAX_TURNS) setFinished(true);
      setMood('idle');
    } catch (e) {
      console.warn('pretend talk failed', e);
      setFailure(talkFailureMessage(e, bot));
      setMood('idle');
    }
  }, [mood, voice, childId, conversationId, lang, day, childName, childAgeBand, apiLevel, authToken, childTurns, bot]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  stopRecordingRef.current = () => { void stopRecording(); };

  const handleFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    stopReplyAudio(playerRef);
    router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
  };

  const petMood = mood === 'thinking' ? 'thinking' : mood === 'recording' ? 'listening' : 'happy';
  const mode = kidModeLabel('pretend', az, bot);

  return (
    <PaperBackground>
      <LessonHeader
        title={mode.name}
        icon={mode.icon}
        step={Math.min(childTurns + 1, MAX_TURNS)}
        total={MAX_TURNS}
        right={<HBButton size="sm" variant="ghost" label={az ? 'Hazır' : 'Готово'} onPress={handleFinish} />}
      />

      {/* Прокручивается, если не влезло, — статус и микрофон всегда на экране. */}
      <ScrollView
        style={styles.middle}
        contentContainerStyle={[styles.middleContent, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(450)}>
          <HBCard bg={accent.soft} style={styles.scenarioCard}>
            <Text style={styles.themeEmoji}>{lesson?.themeEmoji ?? ''}</Text>
            <Text variant="headline" align="center" style={{ color: c.ink }}>
              {az ? 'Gəl oynayaq!' : 'Давай играть!'}
            </Text>
            <Text variant="body" align="center" style={{ color: c.ink }}>
              {az
                ? `Sən və ${bot} «${theme}» mövzusunda macəraya çıxırsınız!`
                : `Ты и ${bot} отправляетесь в приключение: «${theme}»!`}
            </Text>
            <Text variant="caption" align="center" style={{ color: accent.ink }}>
              {az ? `${bot} — macəra yoldaşındır.` : `${bot} — твой напарник.`}
            </Text>
          </HBCard>
        </Animated.View>

        <View style={styles.petArea}>
          <HBPet size={Math.round(t.mascot.hero * 0.6)} mood={petMood} talking={mood === 'playing'} />
        </View>

        <Animated.View key={lastReply ?? 'empty'} entering={FadeInUp.duration(300)}>
          <HBCard style={styles.speechBubble}>
            <Text variant="body" align="center" tone={lastReply ? 'primary' : 'secondary'}>
              {lastReply ?? (az ? 'Danışmağa başla!' : 'Начни говорить!')}
            </Text>
          </HBCard>
        </Animated.View>
      </ScrollView>

      <View style={[styles.statusArea, { paddingHorizontal: t.density.padX }]}>
        {permissionGranted === false ? (
          <InlineBanner
            tone="danger"
            icon="mic-off"
            text={
              az
                ? 'Mikrofon bağlıdır. Telefon ayarlarında icazə ver və ya «Hazır» düyməsini bas.'
                : 'Микрофон выключен. Разреши его в настройках телефона или нажми «Готово».'
            }
          />
        ) : failure ? (
          <InlineBanner
            tone={failure.tone}
            icon={failure.icon}
            title={failure.title}
            text={failure.text}
            onClose={() => setFailure(null)}
          />
        ) : finished ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <HBButton full icon="sparkles" label={az ? 'Dərsə davam et' : 'Продолжить урок'} onPress={handleFinish} />
          </Animated.View>
        ) : (
          <Text variant="caption" tone="secondary" align="center">
            {mood === 'thinking'
              ? (az ? `${bot} düşünür…` : `${bot} думает…`)
              : mood === 'playing'
                ? (az ? `${bot} danışır…` : `${bot} говорит…`)
                : mood === 'recording'
                  ? (az ? 'Dinləyirəm…' : 'Слушаю…')
                  : (az ? `Növbə ${childTurns + 1} / ${MAX_TURNS}` : `Ход ${childTurns + 1} из ${MAX_TURNS}`)}
          </Text>
        )}
      </View>

      {!finished && (
        <Animated.View entering={FadeInUp.duration(350).delay(200)} style={styles.micArea}>
          <MicButton
            state={mood}
            onPress={() => (mood === 'recording' ? stopRecording() : startRecording())}
            disabled={mood === 'thinking' || mood === 'playing' || !permissionGranted}
            accessibilityLabel={az ? 'Mikrofon' : 'Микрофон'}
          />
        </Animated.View>
      )}
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[2] },
  scenarioCard: { alignItems: 'center', gap: spacing[1] },
  themeEmoji: { fontSize: scaleFont(28), lineHeight: scaleFont(36) },
  petArea: { alignItems: 'center' },
  speechBubble: { minHeight: 64, justifyContent: 'center' },
  statusArea: { minHeight: 52, justifyContent: 'center', paddingVertical: spacing[1] },
  micArea: { alignItems: 'center', paddingBottom: spacing[4] },
}));
