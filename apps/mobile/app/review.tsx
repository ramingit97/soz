/**
 * Повторение ошибок: прошлые промахи в игре со словами — снова четыре варианта.
 * Данные — `/progress/:childId/errors`. Оформлено как шаг урока (общая шапка).
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { Skeleton } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { getReviewItems, type ReviewItem } from '@/services/api';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

interface Question {
  prompt: string;
  correct: string;
  options: string[];
  day: number;
}

export default function ReviewScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const addStars = useSettings((s) => s.addStars);
  const isAz = lang === 'az';
  const { c: palette, mode: uiMode, t } = useTheme();
  const styles = stylesByMode[uiMode];
  const learningLang = learningLanguages[0] ?? 'en';

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!childId || !authToken) { setLoading(false); return; }
    getReviewItems(childId, learningLang, authToken)
      .then((data) => setItems(data.filter((it) => it.kind === 'word_game')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, authToken, learningLang]);

  // Build distractor options from past lessons (other vocab words)
  const questions: Question[] = useMemo(() => {
    return items.map((item) => {
      const otherWords = new Set<string>();
      for (let d = 1; d <= 30; d++) {
        const lesson = getLesson(learningLang, d);
        if (lesson) {
          for (const w of lesson.vocabulary) {
            if (w.toLowerCase() !== item.correct.toLowerCase()) otherWords.add(w);
          }
        }
      }
      const distractors = Array.from(otherWords)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const options = [item.correct, ...distractors].sort(() => Math.random() - 0.5);
      return {
        prompt: item.prompt,
        correct: item.correct,
        options,
        day: item.day,
      };
    });
  }, [items, learningLang]);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const handleChoose = (option: string) => {
    if (selected) return;
    setSelected(option);
    const isCorrect = option.toLowerCase() === current!.correct.toLowerCase();
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    setTimeout(() => {
      if (isLast) {
        // Reward stars based on accuracy
        const earned = Math.max(1, Math.round((correctCount + (isCorrect ? 1 : 0)) / questions.length * 5));
        addStars(earned);
        setDone(true);
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
      }
    }, 1200);
  };

  // ── Render states ──────────────────────────────────────────────────────────

  const title = isAz ? 'Təkrar' : 'Повторение';
  const close = () => router.back();

  if (loading) {
    return (
      <PaperBackground>
        <LessonHeader title={title} icon="repeat" step={1} total={5} onClose={close} />
        <View style={[styles.body, { paddingHorizontal: t.density.padX }]}>
          <Skeleton width="80%" height={28} style={{ marginBottom: 32 }} />
          <View style={styles.options}>
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} width="48%" height={68} borderRadius={20} />
            ))}
          </View>
        </View>
      </PaperBackground>
    );
  }

  if (questions.length === 0 || done) {
    return (
      <PaperBackground edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn.duration(400)} style={[styles.center, { paddingHorizontal: t.density.padX }]}>
          <HBPet size={t.mascot.hero} mood="happy" />
          <Text variant="title" align="center">
            {done ? (isAz ? 'Möhtəşəm!' : 'Великолепно!') : isAz ? 'Səhv yoxdur!' : 'Ошибок нет!'}
          </Text>
          {done ? (
            <View style={styles.score}>
              <Text style={styles.scoreText}>
                {correctCount} / {questions.length}
              </Text>
              <Icon name="star" size={28} color={palette.butterDeep} fill={palette.butter} strokeWidth={2} />
            </View>
          ) : null}
          <Text variant="body" tone="secondary" align="center">
            {done
              ? isAz ? 'Sözləri yadda saxlayırsan!' : 'Ты помнишь слова!'
              : isAz ? 'Hər şeyi düz cavablamısan. Belə davam et!' : 'Ты всё отвечал правильно. Так держать!'}
          </Text>
          <HBButton
            icon={done ? 'check' : 'arrow-left'}
            label={done ? (isAz ? 'Davam et' : 'Продолжить') : isAz ? 'Geri' : 'Назад'}
            onPress={close}
          />
        </Animated.View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <LessonHeader title={title} icon="repeat" step={index + 1} total={questions.length} onClose={close} />
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: t.density.padX }]}>
        <Animated.View key={`q-${index}`} entering={FadeInDown.duration(350)} exiting={FadeOut.duration(150)} style={styles.question}>
          <Text variant="label" tone="secondary">{isAz ? 'Xatırla' : 'Вспомни'}</Text>
          <Text style={styles.prompt}>{current!.prompt}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.options}>
          {current!.options.map((opt) => {
            const isRight = !!selected && opt.toLowerCase() === current!.correct.toLowerCase();
            const isWrong = selected === opt && !isRight;
            return (
              <Pressable
                key={opt}
                onPress={() => handleChoose(opt)}
                disabled={!!selected}
                accessibilityRole="button"
                style={[styles.option, isRight && styles.optionRight, isWrong && styles.optionWrong]}
              >
                <Text style={[styles.optionText, isRight && { color: palette.accentDeep }, isWrong && { color: palette.berryDeep }]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        <Text variant="caption" tone="secondary" align="center">
          {isAz ? `${current!.day}-ci gündən` : `Из дня ${current!.day}`}
        </Text>
      </ScrollView>
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  body: { paddingTop: spacing[4], paddingBottom: spacing[10], gap: spacing[5] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  score: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  scoreText: { fontFamily: fontFamily.display, fontSize: fontSize['3xl'], color: t.c.ink },
  question: { alignItems: 'center', gap: spacing[2] },
  prompt: { fontFamily: fontFamily.display, fontSize: fontSize['4xl'], color: t.c.ink },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  option: {
    width: '48.5%',
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: t.c.surfaceBorder,
    backgroundColor: t.c.surface,
    paddingHorizontal: spacing[3],
  },
  optionRight: { backgroundColor: '#E3F7EF', borderColor: '#7AC9B5' },
  optionWrong: { backgroundColor: '#FDE3E8', borderColor: '#F5A3B2' },
  optionText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: t.c.ink },
}));
