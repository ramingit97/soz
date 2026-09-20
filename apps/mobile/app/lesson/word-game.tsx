/**
 * Игра со словами: картинка-эмодзи и четыре слова, выбрать правильное. В игру
 * подмешаны 1–2 раунда из прошлых дней (интервальное повторение). После
 * последнего раунда шаг «слова» засчитывается, дальше — грамматика.
 *
 * Эмодзи-картинка раунда — контент урока, а не иконка интерфейса.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { AnswerSheet } from '@/components/lesson/AnswerSheet';
import { HBCard } from '@/components/HBCard';
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { buildWordGameWithReviews, pickReviewRounds } from '@/services/spacedRepetition';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, scaleFont, spacing } from '@/theme';
import { byMode, makeModeStyles } from '@/theme/modeTokens';

type AnswerState = 'idle' | 'correct' | 'wrong';

const RIGHT_BY_MODE = byMode((t) => ({ bg: t.c.successSoft, border: t.c.success, ink: t.c.successDeep }));
const WRONG_BY_MODE = byMode((t) => ({ bg: t.c.errorSoft, border: t.c.error, ink: t.c.berryDeep }));

export default function WordGameScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  // Раунды собираются один раз на урок. Раньше список строился заново на
  // каждом рендере: массив и его элементы меняли ссылку по десять раз за
  // раунд, и подпись под ответом успевала взять слово из чужого раунда.
  const rounds = useMemo(() => {
    const lesson = getLesson(lang, Number(day));
    const todayRounds = lesson?.wordGame ?? [];
    return buildWordGameWithReviews(todayRounds, pickReviewRounds(lang, Number(day)));
  }, [lang, day]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  /** Что показать в плашке: берётся в момент ответа, чтобы не поехало на смене раунда. */
  const [feedback, setFeedback] = useState<{ title: string; subtitle: string | null } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const recordLessonError = useSettings((s) => s.recordLessonError);
  const childId = useSettings((s) => s.childId);
  const markLessonStep = useSettings((s) => s.markLessonStep);
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const { c: palette, mode: uiMode, t } = useTheme();
  const styles = stylesByMode[uiMode];
  const WRONG = WRONG_BY_MODE[uiMode];
  const RIGHT = RIGHT_BY_MODE[uiMode];

  const shakeX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  const currentRound = rounds[roundIndex] ?? rounds[0];

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
  }));

  const finish = () => {
    if (childId) markLessonStep(childId, String(lang), Number(day), 'words');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push({ pathname: '/lesson/grammar' as any, params: { lang, day } });
  };

  const handleOption = (option: string) => {
    if (answerState !== 'idle' || !currentRound) return;
    setSelectedOption(option);

    if (option === currentRound.correct) {
      setAnswerState('correct');
      setFeedback({
        title: az ? 'Düzdür!' : 'Верно!',
        subtitle: az
          ? `${currentRound.correct} ${currentRound.emoji}`
          : `${currentRound.correct} — это ${currentRound.emoji}`,
      });
      setCorrectCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      cardScale.value = withSequence(withSpring(1.04, { damping: 8 }), withSpring(1));

      setTimeout(() => {
        if (roundIndex < rounds.length - 1) {
          setRoundIndex((i) => i + 1);
          setAnswerState('idle');
          setSelectedOption(null);
          setFeedback(null);
        } else {
          finish();
        }
      }, 900);
    } else {
      setAnswerState('wrong');
      setFeedback({ title: az ? 'Yenidən cəhd et!' : 'Попробуй ещё!', subtitle: null });
      recordLessonError({
        kind: 'word_game',
        prompt: currentRound.emoji,
        correct: currentRound.correct,
        given: option,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shakeX.value = withSequence(
        withTiming(12, { duration: 60 }),
        withTiming(-12, { duration: 60 }),
        withTiming(8, { duration: 60 }),
        withTiming(-8, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      setTimeout(() => {
        setAnswerState('idle');
        setSelectedOption(null);
        setFeedback(null);
      }, 700);
    }
  };

  const title = az ? 'Sözlər' : 'Слова';

  if (!currentRound) {
    // Раундов нет (план ещё не пришёл и встроенного урока нет) — не держать
    // ребёнка на пустом экране, а сразу дальше.
    return (
      <PaperBackground>
        <LessonHeader title={title} icon="book-open" step={1} total={1} />
        <View style={styles.empty}>
          <Text variant="body" tone="secondary" align="center">
            {az ? 'Bu gün söz oyunu yoxdur.' : 'Сегодня игры со словами нет.'}
          </Text>
          <HBButton iconRight="arrow-right" label={az ? 'Davam et' : 'Дальше'} onPress={finish} />
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <LessonHeader
        title={title}
        icon="book-open"
        step={roundIndex + 1}
        total={rounds.length}
        right={
          <View style={styles.scorePill}>
            <Icon name="star" size={16} color={palette.butterDeep} fill={palette.butter} strokeWidth={2} />
            <Text style={styles.scoreText}>{correctCount * 4}</Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text variant="headline">{az ? 'Düzgün sözü seç!' : 'Выбери правильное слово!'}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(100)} style={styles.emojiArea}>
          <Animated.View style={cardStyle}>
            <HBCard style={styles.emojiCard}>
              <Text style={styles.hintEmoji}>{currentRound.emoji}</Text>
              {answerState !== 'idle' ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={[styles.badge, { backgroundColor: answerState === 'correct' ? RIGHT.ink : WRONG.ink }]}
                >
                  <Icon name={answerState === 'correct' ? 'check' : 'x'} size={18} color={palette.white} strokeWidth={3} />
                </Animated.View>
              ) : null}
            </HBCard>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(450).delay(200)} style={styles.optionsGrid}>
          {currentRound.options.map((option) => {
            const isSelected = selectedOption === option;
            const state = isSelected ? answerState : 'idle';
            return (
              <OptionButton
                key={`${roundIndex}-${option}`}
                label={option}
                state={state}
                onPress={() => handleOption(option)}
                disabled={answerState !== 'idle'}
              />
            );
          })}
        </Animated.View>

        <View style={styles.feedbackArea} />
      </ScrollView>

      {feedback ? (
        <AnswerSheet
          tone={answerState === 'correct' ? 'correct' : 'wrong'}
          title={feedback.title}
          subtitle={feedback.subtitle}
        />
      ) : null}
    </PaperBackground>
  );
}

function OptionButton({
  label,
  state,
  onPress,
  disabled,
}: {
  label: string;
  state: AnswerState;
  onPress: () => void;
  disabled: boolean;
}) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const WRONG = WRONG_BY_MODE[uiMode];
  const RIGHT = RIGHT_BY_MODE[uiMode];
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const look = state === 'correct' ? RIGHT : state === 'wrong' ? WRONG : null;

  return (
    <Animated.View style={[animStyle, styles.optionWrap]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        style={[
          styles.optionBtn,
          look ? { backgroundColor: look.bg, borderColor: look.border } : null,
        ]}
      >
        <Text style={[styles.optionText, look ? { color: look.ink } : null]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  scoreText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm, color: t.c.ink },

  emojiArea: { alignItems: 'center' },
  // У детей картинка выглядит наклейкой: толстая белая рамка и лёгкий наклон
  // (макет C). У взрослых — ровная карточка без поворота.
  emojiCard: {
    width: t.mode === 'kid' ? 168 : 136,
    height: t.mode === 'kid' ? 152 : 136,
    alignItems: 'center',
    justifyContent: 'center',
    ...(t.mode === 'kid'
      ? {
          borderWidth: 7,
          borderColor: t.c.white,
          backgroundColor: t.c.bgDeep,
          borderRadius: 32,
          transform: [{ rotate: '-3deg' }],
        }
      : null),
  },
  hintEmoji: { fontSize: scaleFont(64), lineHeight: scaleFont(80) },
  badge: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[3],
  },
  optionWrap: { width: '48.5%' },
  optionBtn: {
    minHeight: 72,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    borderWidth: t.mode === 'kid' ? 3 : 1.5,
    borderColor: t.c.surfaceBorder,
    // Нижняя грань — тот же объём, что у кнопки: вариант ответа выглядит
    // нажимаемым, а не полем ввода.
    borderBottomWidth: t.mode === 'kid' ? 6 : 1.5,
    borderBottomColor: t.c.borderStrong,
    backgroundColor: t.c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xl, color: t.c.ink },

  feedbackArea: { minHeight: 32, justifyContent: 'center' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
}));
