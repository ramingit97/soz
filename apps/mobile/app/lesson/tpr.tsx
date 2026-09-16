/**
 * «Двигайся с Бобо» — TPR (Total Physical Response).
 *
 * Персонаж даёт команду-движение со словом урока: прыгни и скажи «cat».
 * Ребёнок делает и нажимает «Я сделал!». После последнего слова — игра со
 * словами. Команда на языке интерфейса (RU/AZ), слово — на изучаемом.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { fontFamily, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';
import { kidModeLabel } from '@/utils/lessonModes';

type Status = 'idle' | 'done';

/** Эмодзи здесь — картинка движения (контент), а не иконка интерфейса. */
const ACTIONS: { ru: string; az: string; emoji: string }[] = [
  { ru: 'Прыгни и скажи', az: 'Tullan və de', emoji: '🦘' },
  { ru: 'Похлопай и скажи', az: 'Əl çal və de', emoji: '👏' },
  { ru: 'Покружись и крикни', az: 'Fırlan və qışqır', emoji: '🌀' },
  { ru: 'Потрогай нос и скажи', az: 'Burnuna toxun və de', emoji: '👃' },
  { ru: 'Помаши руками и скажи', az: 'Əllərini yellə və de', emoji: '👋' },
  { ru: 'Потопай и скажи', az: 'Ayaqlarını döy və de', emoji: '🦶' },
  { ru: 'Потянись вверх и скажи', az: 'Yuxarı uzan və de', emoji: '🙌' },
  { ru: 'Потанцуй и скажи', az: 'Rəqs et və de', emoji: '🕺' },
];

export default function TPRScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  const vocabulary = lesson?.vocabulary ?? [];
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const bot = useCompanionName();
  const { t, accent } = useTheme();

  const [wordIndex, setWordIndex] = useState(0);
  const [status, setStatus] = useState<Status>('idle');

  const isLast = wordIndex >= vocabulary.length - 1;
  const currentWord = vocabulary[wordIndex] ?? '';
  const action = ACTIONS[wordIndex % ACTIONS.length]!;

  const jump = useSharedValue(0);

  // Новое слово — персонаж подпрыгивает, показывая, что команда сменилась.
  useEffect(() => {
    setStatus('idle');
    jump.value = withSequence(withTiming(-16, { duration: 220 }), withSpring(0, { damping: 5 }));
  }, [wordIndex, jump]);

  const advance = useCallback(() => {
    if (isLast) {
      router.push(`/lesson/word-game?lang=${lang}&day=${day}` as any);
    } else {
      setWordIndex((i) => i + 1);
    }
  }, [isLast, lang, day, router]);

  const handleDone = useCallback(() => {
    if (status !== 'idle') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    jump.value = withSequence(withTiming(-28, { duration: 200 }), withSpring(0, { damping: 4 }));
    setStatus('done');
    setTimeout(advance, 900);
  }, [status, advance, jump]);

  const skipWord = () => {
    Haptics.selectionAsync().catch(() => {});
    advance();
  };

  const petStyle = useAnimatedStyle(() => ({ transform: [{ translateY: jump.value }] }));
  const mode = kidModeLabel('tpr', az, bot);

  return (
    <PaperBackground>
      <LessonHeader
        title={mode.name}
        icon={mode.icon}
        step={wordIndex + 1}
        total={vocabulary.length}
        right={<HBButton size="sm" variant="ghost" label={az ? 'Keç' : 'Пропустить'} onPress={skipWord} />}
      />

      <ScrollView
        style={styles.middle}
        contentContainerStyle={[styles.middleContent, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.petArea, petStyle]}>
          <HBPet size={Math.round(t.mascot.hero * 0.7)} mood={status === 'done' ? 'happy' : 'curious'} />
        </Animated.View>

        <Animated.View key={`cmd-${wordIndex}`} entering={FadeInDown.duration(350)} exiting={FadeOut.duration(150)}>
          <HBCard style={styles.commandCard}>
            <Text variant="caption" tone="secondary">
              {az ? `${bot} deyir:` : `${bot} говорит:`}
            </Text>
            <Text style={styles.actionEmoji}>{action.emoji}</Text>
            <Text variant="headline" align="center">
              {az ? action.az : action.ru}
            </Text>
            <View style={[styles.wordBubble, { backgroundColor: accent.soft }]}>
              <Text style={[styles.wordText, { color: accent.ink }]}>{currentWord.toUpperCase()}</Text>
            </View>
          </HBCard>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottom, { paddingHorizontal: t.density.padX }]}>
        {status === 'done' ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.doneRow}>
            <Icon name="sparkles" size={20} color={accent.ink} strokeWidth={2.5} />
            <Text variant="headline" style={{ color: accent.ink }}>
              {az ? 'Möhtəşəm!' : 'Потрясающе!'}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(350).delay(150)} style={styles.buttonCol}>
            <HBButton full icon="check" label={az ? 'Etdim!' : 'Я сделал!'} onPress={handleDone} />
            <Text variant="caption" tone="secondary" align="center">
              {az ? 'Tapşırığı et, sonra düyməni bas' : 'Выполни задание, потом нажми кнопку'}
            </Text>
          </Animated.View>
        )}
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1 },
  middleContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[2] },
  petArea: { alignItems: 'center' },
  commandCard: { alignItems: 'center', gap: spacing[2] },
  actionEmoji: { fontSize: scaleFont(48), lineHeight: scaleFont(58) },
  wordBubble: {
    marginTop: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius: 20,
  },
  wordText: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(32),
    lineHeight: scaleFont(40),
    letterSpacing: 3,
  },
  bottom: { paddingTop: spacing[2], paddingBottom: spacing[5], minHeight: 96, justifyContent: 'center' },
  buttonCol: { gap: spacing[2] },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
});
