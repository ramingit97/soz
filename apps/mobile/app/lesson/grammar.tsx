import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

import { HBBackButton } from '@/components/HBBackButton';
import { Text } from '@/components/Text';
import { STATIC_GRAMMAR } from '@/data/grammar';
import { getLesson } from '@/data/lessons';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

// Reference the externalized grammar data; keep `GRAMMAR` name as alias for the
// existing reads below so we don't have to rename in 50 places.
const GRAMMAR = STATIC_GRAMMAR;

// Inline GRAMMAR data has been moved to src/data/grammar.ts. Old hard-coded
// definition is removed; the legacy block below would have started here:

interface GrammarExercise {
  kind: 'fill_blank' | 'order_words';
  prompt: string;
  options: string[];
  correct: string | string[];
}

type ExerciseState = 'idle' | 'correct' | 'wrong' | 'reveal';

export default function GrammarScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const dayNum = Number(day);
  // Curriculum-first for ALL days: the AI plan carries level-appropriate grammar
  // (a B2 teen must never see the static A1 "My name is Bobo"). The hard-coded
  // GRAMMAR map is only the offline/pre-cache fallback — bundled lessons have no
  // grammar field, so ?? falls through to it naturally.
  const aiLesson = getLesson(lang, dayNum);
  const rawExercises: GrammarExercise[] =
    aiLesson?.grammar ?? GRAMMAR[lang]?.[dayNum] ?? GRAMMAR.en?.[1] ?? [];
  // Solvability guard: AI-generated order_words sometimes has a `correct`
  // answer whose words don't all exist among the tiles ("...soccer in summer"
  // with no "in" tile) — impossible to solve, the child is stuck forever.
  // If the word multisets differ, rebuild the tiles from the correct answer.
  const exercises: GrammarExercise[] = rawExercises.map((ex) => {
    if (ex.kind !== 'order_words' || !Array.isArray(ex.correct)) return ex;
    const key = (a: string[]) => a.map((w) => w.trim()).sort().join('\u0001');
    return key(ex.options) === key(ex.correct) ? ex : { ...ex, options: [...ex.correct] };
  });

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [state, setState] = useState<ExerciseState>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [orderedWords, setOrderedWords] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<string[]>([]);
  // After 3 wrong tries: reveal the answer and move on — a child must never be
  // stuck on one exercise forever (the miss is already logged for review).
  const failsRef = useRef(0);
  const shakeX = useSharedValue(0);
  const recordLessonError = useSettings((s) => s.recordLessonError);

  // Non-null after the early return below
  const exercise = exercises[exerciseIndex]!;
  const isRu = lang === 'ru';
  const isOrderWords = exercise?.kind === 'order_words';

  // Initialize order_words state when exercise changes
  useState(() => {
    if (exercise?.kind === 'order_words') {
      setRemaining([...exercise.options].sort(() => Math.random() - 0.5));
      setOrderedWords([]);
    }
  });

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(10, { duration: 55 }),
      withTiming(-10, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(0, { duration: 55 }),
    );
  };

  const handleFillBlank = (option: string) => {
    if (state !== 'idle') return;
    setSelected(option);
    if (option === exercise.correct) {
      setState('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(advanceExercise, 900);
    } else {
      recordLessonError({
        kind: 'grammar',
        prompt: exercise.prompt,
        correct: exercise.correct as string,
        given: option,
      });
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
    }
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
    const isCorrect = orderedWords.join(' ') === correct.join(' ');
    if (isCorrect) {
      setState('correct');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(advanceExercise, 900);
    } else {
      recordLessonError({
        kind: 'grammar',
        prompt: exercise.prompt,
        correct: (exercise.correct as string[]).join(' '),
        given: orderedWords.join(' '),
      });
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (++failsRef.current >= 3) {
        setState('reveal');
        setOrderedWords([...correct]); // show the right order in the sentence box
        setRemaining([]);
        setTimeout(advanceExercise, 2200);
        return;
      }
      setState('wrong');
      setTimeout(() => {
        setState('idle');
        setOrderedWords([]);
        setRemaining([...exercise.options].sort(() => Math.random() - 0.5));
      }, 800);
    }
  };

  const advanceExercise = () => {
    failsRef.current = 0;
    if (exerciseIndex < exercises.length - 1) {
      const next = exercises[exerciseIndex + 1];
      setExerciseIndex((i) => i + 1);
      setState('idle');
      setSelected(null);
      if (next?.kind === 'order_words') {
        setRemaining([...next.options].sort(() => Math.random() - 0.5));
        setOrderedWords([]);
      }
    } else {
      router.push(`/talk?lang=${lang}&day=${day}&fromLesson=1`);
    }
  };

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  if (!exercise) return null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.cream, '#F5F0FF', colors.parchment]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <HBBackButton inline />
        <View style={styles.titleArea}>
          <Text style={styles.screenTitle}>
            {isRu ? '⚡ Грамматика' : '⚡ Grammar Quest'}
          </Text>
          <Text style={styles.stepText}>
            {exerciseIndex + 1} / {exercises.length}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.body}>
        {/* Prompt */}
        <Animated.View style={[styles.promptCard, shadow.md, cardAnimStyle]}>
          <Text style={styles.promptLabel}>
            {isRu ? exercise.prompt : exercise.prompt}
          </Text>

          {isOrderWords && (
            <View style={styles.sentenceBox}>
              {orderedWords.length === 0 ? (
                <Text style={styles.sentencePlaceholder}>
                  {isRu ? 'Нажми слова ниже...' : 'Tap words below...'}
                </Text>
              ) : (
                <View style={styles.sentenceWords}>
                  {orderedWords.map((w, i) => (
                    <Pressable
                      key={`${i}-${w}`}
                      onPress={() => handleRemoveWord(w, i)}
                      style={[styles.wordTile, styles.wordTilePlaced]}
                    >
                      <Text style={styles.wordTileText}>{w}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {state !== 'idle' && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[
                styles.resultBadge,
                state === 'correct' ? styles.correct : state === 'reveal' ? styles.revealBadge : styles.wrong,
              ]}
            >
              <Text style={styles.resultText}>
                {state === 'correct'
                  ? (isRu ? '✅ Верно!' : '✅ Correct!')
                  : state === 'reveal'
                    ? (isRu
                        ? `💡 Правильный ответ: ${Array.isArray(exercise.correct) ? exercise.correct.join(' ') : exercise.correct}`
                        : `💡 Answer: ${Array.isArray(exercise.correct) ? exercise.correct.join(' ') : exercise.correct}`)
                    : (isRu ? '❌ Попробуй снова' : '❌ Try again')}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Options */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)}>
          {isOrderWords ? (
            <View style={styles.wordBank}>
              {remaining.map((word, i) => (
                <Pressable
                  key={`${i}-${word}`}
                  onPress={() => handleAddWord(word, i)}
                  style={[styles.wordTile, styles.wordTileBank, shadow.sm]}
                >
                  <Text style={styles.wordTileBankText}>{word}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.optionsGrid}>
              {exercise.options.map((opt) => {
                const isChosen = selected === opt;
                const isGood = isChosen && (state === 'correct' || state === 'reveal');
                const isBad = isChosen && state === 'wrong';
                return (
                  <Pressable
                    key={opt}
                    onPress={() => handleFillBlank(opt)}
                    disabled={state !== 'idle'}
                    style={[
                      styles.optionBtn,
                      shadow.sm,
                      isGood && styles.optionCorrect,
                      isBad && styles.optionWrong,
                    ]}
                  >
                    <Text style={[
                      styles.optionText,
                      isGood && { color: '#1A8C66' },
                      isBad && { color: colors.error },
                    ]}>
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Check button for order_words */}
          {isOrderWords && orderedWords.length === exercise.options.length && state === 'idle' && (
            <Animated.View entering={FadeInUp.duration(300)} style={{ marginTop: spacing[5] }}>
              <Pressable onPress={checkOrder} style={styles.checkBtn}>
                <LinearGradient
                  colors={[colors.primary, colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkBtnGradient}
                >
                  <Text style={styles.checkBtnText}>
                    {isRu ? 'Проверить ✓' : 'Check ✓'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  blob1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 300,
    backgroundColor: colors.primarySoft, opacity: 0.5, top: -100, right: -80,
  },
  blob2: {
    position: 'absolute', width: 260, height: 260, borderRadius: 260,
    backgroundColor: colors.russianLight, opacity: 0.4, bottom: -80, left: -60,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[14],
    paddingBottom: spacing[3],
  },
  titleArea: { alignItems: 'center' },
  screenTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  stepText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  body: { flex: 1, paddingHorizontal: spacing[5] },

  promptCard: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    marginBottom: spacing[5],
    minHeight: 140,
    justifyContent: 'center',
  },
  promptLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    lineHeight: 36,
    marginBottom: spacing[3],
  },

  sentenceBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing[4],
    minHeight: 52,
  },
  sentencePlaceholder: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  sentenceWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },

  resultBadge: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  correct: { backgroundColor: '#E8FBF5', borderWidth: 1, borderColor: colors.accent },
  wrong: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: colors.error },
  revealBadge: { backgroundColor: '#FFF8D6', borderWidth: 1, borderColor: colors.butter, alignSelf: 'stretch' },
  resultText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },

  wordBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  wordTile: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  wordTilePlaced: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  wordTileBank: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  wordTileText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.primary,
  },
  wordTileBankText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },

  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    justifyContent: 'center',
  },
  optionBtn: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: '45%',
    alignItems: 'center',
  },
  optionCorrect: { backgroundColor: '#E8FBF5', borderColor: colors.accent },
  optionWrong: { backgroundColor: '#FFF0F0', borderColor: colors.error },
  optionText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xl,
    color: colors.ink,
  },

  checkBtn: { borderRadius: radius.full, overflow: 'hidden' },
  checkBtnGradient: { paddingVertical: spacing[4], alignItems: 'center' },
  checkBtnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
  },
});
