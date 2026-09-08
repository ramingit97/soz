/**
 * Review mode — replay past word-game mistakes.
 * Powered by the aggregated /progress/:childId/errors endpoint.
 * Each item is a 4-option multiple-choice (same UX as the word-game step).
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { getReviewItems, type ReviewItem } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

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

  if (loading) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FFF6EC', '#F5EBFF']} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.progressRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width={8} height={8} borderRadius={4} />
            ))}
          </View>
          <Skeleton width={120} height={11} style={{ marginBottom: 12, alignSelf: 'center' }} />
          <Skeleton width="80%" height={28} style={{ marginBottom: 32, alignSelf: 'center' }} />
          <View style={styles.optionsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width="47%" height={68} borderRadius={20} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FFF6EC', '#F5EBFF']} style={StyleSheet.absoluteFill} />
        <View style={styles.emptyArea}>
          <Bobo size={120} mood="happy" />
          <Text style={styles.emptyTitle}>
            {isAz ? 'Heç bir səhv yoxdur!' : 'Ошибок нет!'}
          </Text>
          <Text style={styles.emptySub}>
            {isAz
              ? 'Sən hər şeyi düzgün cavablamışsan. Davam et!'
              : 'Ты всё отвечал правильно. Так держать!'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backToHomeBtn}>
            <Text style={styles.backToHomeText}>
              {isAz ? 'Geri qayıt' : 'Назад'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#FFF6EC', '#F5EBFF']} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeIn.duration(500)} style={styles.emptyArea}>
          <Bobo size={120} mood="happy" />
          <Text style={styles.emptyTitle}>
            {isAz ? 'Möhtəşəm!' : 'Великолепно!'}
          </Text>
          <Text style={styles.scoreText}>
            {correctCount} / {questions.length} ⭐
          </Text>
          <Text style={styles.emptySub}>
            {isAz
              ? 'Sözləri xatırlayırsan!'
              : 'Ты помнишь слова!'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backToHomeBtn}>
            <Text style={styles.backToHomeText}>
              {isAz ? 'Davam et' : 'Продолжить'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#FFF6EC', '#F5EBFF']} style={StyleSheet.absoluteFill} />

      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress dots */}
        <View style={styles.progressRow}>
          {questions.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index && styles.dotActive,
                i < index && styles.dotDone,
              ]}
            />
          ))}
        </View>

        {/* Question */}
        <Animated.View
          key={`q-${index}`}
          entering={FadeInDown.duration(350)}
          exiting={FadeOut.duration(150)}
          style={styles.questionArea}
        >
          <Text style={styles.questionLabel}>
            {isAz ? 'TƏKRAR ET' : 'ПОВТОРИ'}
          </Text>
          <Text style={styles.prompt}>
            {current!.prompt}
          </Text>
        </Animated.View>

        {/* Options */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)} style={styles.optionsGrid}>
          {current!.options.map((opt) => {
            const isSel = selected === opt;
            const isCorrect = selected && opt.toLowerCase() === current!.correct.toLowerCase();
            const isWrong = isSel && opt.toLowerCase() !== current!.correct.toLowerCase();
            return (
              <Pressable
                key={opt}
                onPress={() => handleChoose(opt)}
                disabled={!!selected}
                style={[
                  styles.option,
                  shadow.sm,
                  isCorrect && styles.optionCorrect,
                  isWrong && styles.optionWrong,
                  selected && !isSel && opt.toLowerCase() === current!.correct.toLowerCase() && styles.optionCorrect,
                ]}
              >
                <Text style={[
                  styles.optionText,
                  (isCorrect || (selected && opt.toLowerCase() === current!.correct.toLowerCase())) && { color: colors.white },
                  isWrong && { color: colors.white },
                ]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>

        <Text style={styles.dayTag}>
          {isAz ? `${current!.day}. gündən` : `Из дня ${current!.day}`}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF6EC' },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[14],
    paddingBottom: spacing[10],
    alignItems: 'center',
  },

  loaderArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },

  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  scoreText: {
    fontFamily: fontFamily.display,
    fontSize: 48,
    color: colors.primary,
    marginVertical: spacing[1],
  },
  backToHomeBtn: {
    marginTop: spacing[4],
    backgroundColor: colors.primary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.full,
  },
  backToHomeText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
  },

  closeBtn: {
    position: 'absolute',
    top: spacing[14],
    right: spacing[5],
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  closeText: {
    fontSize: 16,
    color: colors.inkSoft,
  },

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.success,
  },

  questionArea: {
    alignItems: 'center',
    marginBottom: spacing[8],
    gap: spacing[2],
  },
  questionLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.inkSoft,
    letterSpacing: 1.5,
  },
  prompt: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    maxWidth: 320,
  },

  optionsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  option: {
    width: '47%',
    paddingVertical: spacing[5],
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  optionCorrect: { backgroundColor: colors.success },
  optionWrong: { backgroundColor: colors.error },
  optionText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },

  dayTag: {
    marginTop: spacing[6],
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },
});
