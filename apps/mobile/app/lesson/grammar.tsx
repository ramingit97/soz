/**
 * Грамматика — шаг урока после слов: вставить слово в пропуск или собрать
 * предложение из плиток. После трёх ошибок ответ показывается, и урок идёт
 * дальше: застрять на одном упражнении нельзя (промах уже записан в отчёт).
 * В конце шаг «грамматика» засчитывается, дальше — разговор.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { Icon, type IconName } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { STATIC_GRAMMAR } from '@/data/grammar';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface GrammarExercise {
  kind: 'fill_blank' | 'order_words';
  prompt: string;
  options: string[];
  correct: string | string[];
}

type ExerciseState = 'idle' | 'correct' | 'wrong' | 'reveal';

const RIGHT = { bg: '#E3F7EF', border: '#7AC9B5', ink: colors.accentDeep };
const WRONG = { bg: '#FDE3E8', border: '#F5A3B2', ink: colors.berryDeep };
const WORD_SEPARATOR = String.fromCharCode(1);

const shuffled = (words: string[]) => [...words].sort(() => Math.random() - 0.5);
const answerText = (ex: GrammarExercise) => (Array.isArray(ex.correct) ? ex.correct.join(' ') : ex.correct);

export default function GrammarScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const dayNum = Number(day);
  // Сначала план из куррикулума для ВСЕХ дней: в нём грамматика по уровню (подростку
  // B2 нельзя показывать статичное A1 «My name is Bobo»). Встроенный набор —
  // только запасной вариант без сети или до кэша.
  const aiLesson = getLesson(lang, dayNum);
  const rawExercises: GrammarExercise[] =
    aiLesson?.grammar ?? STATIC_GRAMMAR[lang]?.[dayNum] ?? STATIC_GRAMMAR.en?.[1] ?? [];
  // Решаемость: у сгенерированного order_words в `correct` бывают слова, которых
  // нет среди плиток («...soccer in summer» без плитки «in») — такое не собрать.
  // Если наборы слов расходятся, плитки строятся из правильного ответа.
  const exercises: GrammarExercise[] = rawExercises.map((ex) => {
    if (ex.kind !== 'order_words' || !Array.isArray(ex.correct)) return ex;
    const key = (a: string[]) => a.map((w) => w.trim()).sort().join(WORD_SEPARATOR);
    return key(ex.options) === key(ex.correct) ? ex : { ...ex, options: [...ex.correct] };
  });

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [state, setState] = useState<ExerciseState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [orderedWords, setOrderedWords] = useState<string[]>([]);
  // Плитки первого упражнения — сразу в начальном состоянии. Раньше их ставил
  // setState внутри инициализатора useState, то есть во время рендера.
  const [remaining, setRemaining] = useState<string[]>(() =>
    exercises[0]?.kind === 'order_words' ? shuffled(exercises[0].options) : [],
  );
  const failsRef = useRef(0);
  const shakeX = useSharedValue(0);
  const recordLessonError = useSettings((s) => s.recordLessonError);
  const childId = useSettings((s) => s.childId);
  const markLessonStep = useSettings((s) => s.markLessonStep);
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const { t, accent } = useTheme();

  const exercise = exercises[exerciseIndex];
  const isOrderWords = exercise?.kind === 'order_words';
  const title = az ? 'Qrammatika' : 'Грамматика';

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(10, { duration: 55 }),
      withTiming(-10, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  };

  const advanceExercise = () => {
    failsRef.current = 0;
    if (exerciseIndex < exercises.length - 1) {
      const next = exercises[exerciseIndex + 1];
      setExerciseIndex((i) => i + 1);
      setState('idle');
      setSelected(null);
      setOrderedWords([]);
      setRemaining(next?.kind === 'order_words' ? shuffled(next.options) : []);
    } else {
      if (childId) markLessonStep(childId, lang, dayNum, 'grammar');
      router.push(`/talk?lang=${lang}&day=${day}&fromLesson=1`);
    }
  };

  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  if (!exercise) {
    return (
      <PaperBackground>
        <LessonHeader title={title} icon="lightbulb" step={1} total={1} />
        <View style={styles.empty}>
          <Text variant="body" tone="secondary" align="center">
            {az ? 'Bu gün qrammatika yoxdur.' : 'Сегодня грамматики нет.'}
          </Text>
          <HBButton iconRight="arrow-right" label={az ? 'Davam et' : 'Дальше'} onPress={advanceExercise} />
        </View>
      </PaperBackground>
    );
  }

  const handleFillBlank = (option: string) => {
    if (state !== 'idle') return;
    setSelected(option);
    if (option === exercise.correct) {
      setState('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(advanceExercise, 900);
      return;
    }
    recordLessonError({ kind: 'grammar', prompt: exercise.prompt, correct: exercise.correct as string, given: option });
    shake();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (++failsRef.current >= 3) {
      setState('reveal');
      setSelected(exercise.correct as string);
      setTimeout(advanceExercise, 1800);
      return;
    }
    setState('wrong');
    setTimeout(() => { setState('idle'); setSelected(null); }, 700);
  };

  const handleAddWord = (word: string, idx: number) => {
    if (state !== 'idle') return;
    setOrderedWords((prev) => [...prev, word]);
    setRemaining((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveWord = (word: string, idx: number) => {
    if (state !== 'idle') return;
    setOrderedWords((prev) => prev.filter((_, i) => i !== idx));
    setRemaining((prev) => [...prev, word]);
  };

  const checkOrder = () => {
    const correct = exercise.correct as string[];
    if (orderedWords.join(' ') === correct.join(' ')) {
      setState('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(advanceExercise, 900);
      return;
    }
    recordLessonError({
      kind: 'grammar',
      prompt: exercise.prompt,
      correct: correct.join(' '),
      given: orderedWords.join(' '),
    });
    shake();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (++failsRef.current >= 3) {
      setState('reveal');
      setOrderedWords([...correct]); // правильный порядок — в поле предложения
      setRemaining([]);
      setTimeout(advanceExercise, 2200);
      return;
    }
    setState('wrong');
    setTimeout(() => {
      setState('idle');
      setOrderedWords([]);
      setRemaining(shuffled(exercise.options));
    }, 800);
  };

  const result: { icon: IconName; color: string; bg: string; text: string } | null =
    state === 'correct'
      ? { icon: 'circle-check', color: RIGHT.ink, bg: RIGHT.bg, text: az ? 'Düzdür!' : 'Верно!' }
      : state === 'wrong'
        ? { icon: 'refresh-cw', color: WRONG.ink, bg: WRONG.bg, text: az ? 'Yenidən cəhd et' : 'Попробуй снова' }
        : state === 'reveal'
          ? {
              icon: 'lightbulb',
              color: '#7F6628',
              bg: '#FFF6D6',
              text: az ? `Düzgün cavab: ${answerText(exercise)}` : `Правильный ответ: ${answerText(exercise)}`,
            }
          : null;

  return (
    <PaperBackground>
      <LessonHeader title={title} icon="lightbulb" step={exerciseIndex + 1} total={exercises.length} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={cardAnimStyle}>
          <HBCard style={styles.promptCard}>
            <Text variant="headline">{exercise.prompt}</Text>

            {isOrderWords ? (
              <View style={[styles.sentenceBox, { backgroundColor: accent.soft }]}>
                {orderedWords.length === 0 ? (
                  <Text variant="caption" style={{ color: accent.ink }}>
                    {az ? 'Aşağıdakı sözlərə bas…' : 'Нажимай на слова ниже…'}
                  </Text>
                ) : (
                  <View style={styles.sentenceWords}>
                    {orderedWords.map((w, i) => (
                      <Pressable
                        key={`${i}-${w}`}
                        onPress={() => handleRemoveWord(w, i)}
                        accessibilityRole="button"
                        style={[styles.wordTile, { backgroundColor: colors.surface, borderColor: accent.bottom }]}
                      >
                        <Text style={[styles.wordTileText, { color: accent.ink }]}>{w}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {result ? (
              <Animated.View entering={FadeIn.duration(200)} style={[styles.result, { backgroundColor: result.bg }]}>
                <Icon name={result.icon} size={16} color={result.color} strokeWidth={2.5} />
                <Text variant="bodyBold" style={[styles.resultText, { color: result.color }]}>
                  {result.text}
                </Text>
              </Animated.View>
            ) : null}
          </HBCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(150)} style={{ gap: spacing[4] }}>
          {isOrderWords ? (
            <View style={styles.wordBank}>
              {remaining.map((word, i) => (
                <Pressable
                  key={`${i}-${word}`}
                  onPress={() => handleAddWord(word, i)}
                  accessibilityRole="button"
                  style={[styles.wordTile, styles.wordTileBank]}
                >
                  <Text style={styles.wordTileText}>{word}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.optionsGrid}>
              {exercise.options.map((opt) => {
                const isChosen = selected === opt;
                const look =
                  isChosen && (state === 'correct' || state === 'reveal') ? RIGHT : isChosen && state === 'wrong' ? WRONG : null;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => handleFillBlank(opt)}
                    disabled={state !== 'idle'}
                    accessibilityRole="button"
                    style={[styles.optionBtn, look ? { backgroundColor: look.bg, borderColor: look.border } : null]}
                  >
                    <Text style={[styles.optionText, look ? { color: look.ink } : null]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isOrderWords && orderedWords.length === exercise.options.length && state === 'idle' ? (
            <Animated.View entering={FadeInUp.duration(250)}>
              <HBButton full icon="check" label={az ? 'Yoxla' : 'Проверить'} onPress={checkOrder} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[8] },

  promptCard: { gap: spacing[3], minHeight: 120, justifyContent: 'center' },

  sentenceBox: { borderRadius: radius.lg, padding: spacing[3], minHeight: 52, justifyContent: 'center' },
  sentenceWords: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },

  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  resultText: { flexShrink: 1 },

  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center' },
  wordTile: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  wordTileBank: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
  wordTileText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.ink },

  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  optionBtn: {
    width: '48.5%',
    minHeight: 60,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: colors.ink },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
});
