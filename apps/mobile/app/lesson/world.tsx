/**
 * «Покажи свой мир» — персонаж просит найти вокруг что-то, связанное со словом
 * урока, и рассказать. Ребёнок говорит свободно, персонаж отвечает. После
 * MAX_PROMPTS заданий — игра со словами. Задания на языке интерфейса (RU/AZ).
 */

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestRecordingPermissionsAsync, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { type IconName } from '@/components/Icon';
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
import { fontFamily, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { kidModeLabel } from '@/utils/lessonModes';
import { talkFailureMessage, type TalkFailureMessage } from '@/utils/talkAlert';

type Mood = 'idle' | 'recording' | 'thinking' | 'playing';

const MAX_PROMPTS = 3;

/** Задание к слову. Без падежных окончаний у имени персонажа: имя может быть любым. */
function worldPrompt(word: string, az: boolean, index: number): { text: string; icon: IconName } {
  const w = `«${word}»`;
  const prompts: { ru: string; az: string; icon: IconName }[] = [
    { ru: `Найди рядом что-нибудь про ${w} и расскажи!`, az: `Yaxınlıqda ${w} ilə bağlı nəsə tap və danış!`, icon: 'target' },
    { ru: `Посмотри вокруг: что напоминает ${w}?`, az: `Ətrafına bax: ${w} sənə nəyi xatırladır?`, icon: 'globe' },
    { ru: `Где в твоём мире есть ${w}? Покажи и расскажи!`, az: `Sənin dünyanda ${w} harada var? Göstər və danış!`, icon: 'sparkles' },
    { ru: `Опиши что-нибудь, похожее на ${w}!`, az: `${w} kimi bir şeyi təsvir et!`, icon: 'lightbulb' },
  ];
  const p = prompts[index % prompts.length]!;
  return { text: az ? p.az : p.ru, icon: p.icon };
}

export default function WorldScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const vocabulary = lesson?.vocabulary ?? [];
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const bot = useCompanionName();
  const { t, accent } = useTheme();

  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const authToken = useSettings((s) => s.authToken);

  const apiLevel = childLevel ?? 'beginner';
  const conversationId = `world-${childId}-d${day}-${lang}`;

  const [promptIndex, setPromptIndex] = useState(0);
  const [mood, setMood] = useState<Mood>('idle');
  const [reply, setReply] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<TalkFailureMessage | null>(null);

  const voice = useVoiceRecorder();
  const playerRef = useRef<AudioPlayer | null>(null);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWord = vocabulary.length ? vocabulary[promptIndex % vocabulary.length]! : '';
  const prompt = worldPrompt(currentWord, az, promptIndex);
  const isLast = promptIndex >= MAX_PROMPTS - 1;

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setPermissionGranted(granted);
      if (granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
    return () => {
      if (nextTimer.current) clearTimeout(nextTimer.current);
      stopReplyAudio(playerRef);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!permissionGranted || mood !== 'idle' || done) return;
    setFailure(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMood('recording');
    // Запись останавливается сама, когда ребёнок замолчал.
    await voice.start({ onAutoStop: () => stopRecordingRef.current?.() });
  }, [permissionGranted, mood, done, voice]);

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

      setReply(response.responseText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (response.audioBase64) {
        setMood('playing');
        await playReplyAudio(playerRef, response.audioBase64, response.audioMimeType, 'world');
      }

      setMood('idle');
      if (isLast) {
        setDone(true);
      } else {
        // Короткая пауза, чтобы ответ успели прочитать, и следующее задание.
        nextTimer.current = setTimeout(() => {
          setReply(null);
          setPromptIndex((i) => i + 1);
        }, 1500);
      }
    } catch (e) {
      console.warn('world talk failed', e);
      setFailure(talkFailureMessage(e, bot));
      setMood('idle');
    }
  }, [mood, voice, childId, conversationId, lang, day, childName, childAgeBand, apiLevel, authToken, isLast, bot]);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  stopRecordingRef.current = () => { void stopRecording(); };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    stopReplyAudio(playerRef);
    router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
  };

  const skipPrompt = () => {
    Haptics.selectionAsync().catch(() => {});
    if (isLast) setDone(true);
    else { setPromptIndex((i) => i + 1); setReply(null); }
  };

  const petMood = mood === 'recording' ? 'listening' : mood === 'thinking' ? 'thinking' : 'happy';
  const mode = kidModeLabel('world', az, bot);

  return (
    <PaperBackground>
      <LessonHeader
        title={mode.name}
        icon={mode.icon}
        step={promptIndex + 1}
        total={MAX_PROMPTS}
        right={done ? undefined : <HBButton size="sm" variant="ghost" label={az ? 'Növbəti' : 'Дальше'} onPress={skipPrompt} />}
      />

      {/* Прокручивается, если не влезло, — подсказка и микрофон всегда на экране. */}
      <ScrollView
        style={styles.middle}
        contentContainerStyle={[styles.middleContent, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.petArea}>
          <HBPet
            size={Math.round(t.mascot.hero * (done ? 0.85 : 0.65))}
            mood={petMood}
            talking={mood === 'playing'}
          />
        </View>

        {done ? (
          <Animated.View entering={FadeIn.duration(350)} style={styles.doneArea}>
            <Text variant="title" align="center">
              {az ? `${bot} sənin dünyanı gördü!` : `${bot} увидел твой мир!`}
            </Text>
            <HBButton full iconRight="arrow-right" label={az ? 'Dərsə davam et' : 'Продолжить урок'} onPress={handleContinue} />
          </Animated.View>
        ) : (
          <>
            <Animated.View key={`prompt-${promptIndex}`} entering={FadeInDown.duration(350)} exiting={FadeOut.duration(150)}>
              <HBCard style={styles.promptCard}>
                <HBIconBox icon={prompt.icon} tint={accent.soft} iconColor={accent.ink} size={44} />
                <Text variant="headline" align="center">
                  {prompt.text}
                </Text>
                <View style={[styles.wordTag, { backgroundColor: accent.soft }]}>
                  <Text style={[styles.wordTagText, { color: accent.ink }]}>{currentWord.toUpperCase()}</Text>
                </View>
              </HBCard>
            </Animated.View>

            {reply ? (
              <Animated.View key={reply} entering={FadeInUp.duration(300)} exiting={FadeOut.duration(150)}>
                <HBCard style={styles.replyBubble}>
                  <Text variant="body" align="center">
                    {reply}
                  </Text>
                </HBCard>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      {!done && (
        <>
          <View style={[styles.hintArea, { paddingHorizontal: t.density.padX }]}>
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
            ) : failure ? (
              <InlineBanner
                tone={failure.tone}
                icon={failure.icon}
                title={failure.title}
                text={failure.text}
                onClose={() => setFailure(null)}
              />
            ) : (
              <Text variant="caption" tone="secondary" align="center">
                {mood === 'thinking'
                  ? (az ? `${bot} dinləyir…` : `${bot} слушает…`)
                  : mood === 'playing'
                    ? (az ? `${bot} cavab verir…` : `${bot} отвечает…`)
                    : mood === 'recording'
                      ? (az ? 'Danış!' : 'Рассказывай!')
                      : (az ? 'Bas və danış' : 'Нажми и расскажи')}
              </Text>
            )}
          </View>

          <Animated.View entering={FadeInUp.duration(350).delay(200)} style={styles.micArea}>
            <MicButton
              state={mood}
              onPress={() => (mood === 'recording' ? stopRecording() : startRecording())}
              disabled={mood === 'thinking' || mood === 'playing' || !permissionGranted}
              accessibilityLabel={az ? 'Mikrofon' : 'Микрофон'}
            />
          </Animated.View>
        </>
      )}
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[2] },
  petArea: { alignItems: 'center' },
  promptCard: { alignItems: 'center', gap: spacing[2] },
  wordTag: { paddingVertical: spacing[2], paddingHorizontal: spacing[5], borderRadius: 16 },
  wordTagText: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(24),
    lineHeight: scaleFont(30),
    letterSpacing: 3,
  },
  replyBubble: { justifyContent: 'center' },
  doneArea: { gap: spacing[4], alignItems: 'stretch' },
  hintArea: { minHeight: 44, justifyContent: 'center', paddingVertical: spacing[1] },
  micArea: { alignItems: 'center', paddingBottom: spacing[4] },
});
