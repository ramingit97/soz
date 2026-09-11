/**
 * Honeybear · Weekly Quiz / Daily Test.
 *
 * Top bar: close + progress chip + hearts.
 * Prompt centered with kicker + word + sound chip.
 * 4 image-option tiles in pastel colors with selected ring.
 * Encouragement banner with badge.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { ReactingPet, type ReactingPetHandle } from '@/components/ReactingPet';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing, tints } from '@/theme';

interface QuizRound {
  emoji: string;
  correct: string;
  options: string[];
  fromDay: number;
}

const OPTION_TINTS = [tints.primary, tints.butter, tints.sage, tints.berry];

function buildQuiz(lang: string, currentDay: number): QuizRound[] {
  const startDay = Math.max(1, currentDay - 7);
  const allRounds: QuizRound[] = [];
  const allCorrectWords: string[] = [];

  for (let d = startDay; d < currentDay; d++) {
    const lesson = getLesson(lang, d);
    if (!lesson?.wordGame) continue;
    for (const r of lesson.wordGame) {
      allRounds.push({ ...r, fromDay: d });
      if (!allCorrectWords.includes(r.correct)) allCorrectWords.push(r.correct);
    }
  }

  const picked = [...allRounds].sort(() => Math.random() - 0.5).slice(0, 7);

  return picked.map((r) => {
    const distractors = allCorrectWords
      .filter((w) => w !== r.correct)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [r.correct, ...distractors].sort(() => Math.random() - 0.5);
    return { ...r, options };
  });
}

export default function QuizScreen() {
  const router = useRouter();
  const { lang = 'en', endDay = '7' } = useLocalSearchParams<{ lang: string; endDay: string }>();
  const isRu = lang === 'ru';
  const addStars = useSettings((s) => s.addStars);

  const rounds = useMemo(() => buildQuiz(lang, Number(endDay) + 1), [lang, endDay]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [hearts, setHearts] = useState(3);

  // Companion cheers/sympathizes on every answer (reaction-as-reward)
  const petHue = useSettings((s) => s.petHue);
  const petRef = useRef<ReactingPetHandle>(null);
  const [petStars, setPetStars] = useState<number[]>([]);
  const petStarId = useRef(0);

  const shakeX = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
  }));

  const currentRound = rounds[roundIndex];

  const handleOption = (option: string) => {
    if (answerState !== 'idle' || !currentRound) return;
    setSelected(option);

    if (option === currentRound.correct) {
      setAnswerState('correct');
      setScore((s) => s + 1);
      playSfx('success');
      petRef.current?.react('correct');
      const ids = [++petStarId.current, ++petStarId.current];
      setPetStars((s) => [...s, ...ids]);
      setTimeout(() => setPetStars((s) => s.filter((id) => !ids.includes(id))), 1200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      cardScale.value = withSequence(withSpring(1.04, { damping: 8 }), withSpring(1));
    } else {
      setAnswerState('wrong');
      setHearts((h) => Math.max(0, h - 1));
      playSfx('error', 0.7);
      petRef.current?.react('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shakeX.value = withSequence(
        withTiming(12, { duration: 60 }),
        withTiming(-12, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
    }

    setTimeout(() => {
      if (roundIndex < rounds.length - 1) {
        setRoundIndex((i) => i + 1);
        setAnswerState('idle');
        setSelected(null);
      } else {
        const earned = Math.round((score + (option === currentRound.correct ? 1 : 0)) * 3);
        addStars(earned);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setDone(true);
      }
    }, 900);
  };

  if (rounds.length === 0) {
    return (
      <PaperBackground>
        <View style={styles.emptyRoot}>
          <Text style={styles.emptyText}>
            {isRu ? 'Нет слов для теста' : 'No words for the quiz'}
          </Text>
        </View>
      </PaperBackground>
    );
  }

  if (done) {
    const total = rounds.length;
    const percentage = Math.round((score / total) * 100);
    return (
      <PaperBackground variant="honey">
        <View style={styles.doneContent}>
          <Animated.View entering={FadeInDown.duration(700)}>
            <HBPet size={140} mood="happy" />
          </Animated.View>
          <Animated.Text entering={FadeIn.duration(500).delay(300)} style={styles.scoreText}>
            {score} / {total}
          </Animated.Text>
          <Animated.View entering={FadeInUp.duration(500).delay(500)} style={{ alignItems: 'center', gap: spacing[1] }}>
            <Text style={styles.completeTitle}>
              {isRu ? '🎉 Тест пройден!' : '🎉 Quiz complete!'}
            </Text>
            <Text style={styles.completeSub}>
              {percentage >= 80
                ? (isRu ? 'Отличная память!' : 'Great memory!')
                : percentage >= 50
                ? (isRu ? 'Хорошая работа!' : 'Good job!')
                : (isRu ? 'Так держать!' : 'Keep going!')}
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500).delay(700)} style={{ width: '100%', paddingHorizontal: spacing[6] }}>
            <HBButton
              full
              variant="primary"
              label={isRu ? 'На главную 🏠' : 'Go home 🏠'}
              onPress={() => router.replace('/home')}
            />
          </Animated.View>
        </View>
      </PaperBackground>
    );
  }

  if (!currentRound) return null;

  return (
    <PaperBackground>
      <View style={styles.container}>
        {/* top bar */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, shadow.sm]}>
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
          <View style={[styles.testChip, shadow.sm]}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={styles.testChipText}>
              {isRu ? `Тест · ${roundIndex + 1} / ${rounds.length}` : `Quiz · ${roundIndex + 1} / ${rounds.length}`}
            </Text>
          </View>
          <View style={[styles.heartsChip, shadow.sm]}>
            <Text style={{ fontSize: 14 }}>❤️</Text>
            <Text style={styles.heartsText}>{hearts}</Text>
          </View>
        </Animated.View>

        {/* progress bar */}
        <View style={styles.progressRow}>
          {rounds.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                i < roundIndex && { backgroundColor: colors.accent },
                i === roundIndex && { backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>

        {/* companion cheerleader — absolute so the quiz layout never shifts */}
        <View pointerEvents="none" style={styles.petCorner}>
          <ReactingPet ref={petRef} size={56} hue={petHue} mood="curious" />
          {petStars.map((id) => (
            <StarParticle key={id} x={4 + (id % 3) * 16} y={-4} delay={(id % 2) * 120} />
          ))}
        </View>

        {/* prompt */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.promptArea}>
          <Text style={styles.kicker}>
            {isRu ? 'ВЫБЕРИ КАРТИНКУ' : 'CHOOSE THE PICTURE'}
          </Text>
          <Text style={styles.word}>{currentRound.correct}</Text>
          <View style={styles.soundChip}>
            <Text style={{ fontSize: fontSize.xs, color: colors.primary }}>🔊</Text>
            <Text style={styles.soundText}>
              {isRu ? 'прослушать' : 'listen'}
            </Text>
          </View>
        </Animated.View>

        {/* options grid */}
        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.optionsGrid}>
          {currentRound.options.map((option, i) => {
            const isSelected = selected === option;
            const isCorrect = isSelected && answerState === 'correct';
            const isWrong = isSelected && answerState === 'wrong';
            const tint = OPTION_TINTS[i % OPTION_TINTS.length] ?? colors.bg;
            const ringColor = isCorrect ? colors.accent : isWrong ? colors.berry : isSelected ? colors.primary : undefined;
            const matchedRound = rounds.find(r => r.correct === option || r.options.includes(option));
            const emoji = option === currentRound.correct
              ? currentRound.emoji
              : (matchedRound?.emoji ?? '🔤');
            return (
              <Pressable
                key={`${roundIndex}-${option}`}
                onPress={() => handleOption(option)}
                disabled={answerState !== 'idle'}
                style={({ pressed }) => [
                  styles.optionTile,
                  { backgroundColor: tint },
                  ringColor ? { borderColor: ringColor, borderWidth: 3 } : null,
                  shadow.md,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Animated.View style={cardStyle}>
                  <Text style={styles.optionEmoji}>{emoji}</Text>
                </Animated.View>
                <Text style={styles.optionText}>{option}</Text>
                {isCorrect && (
                  <View style={[styles.optionBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.optionBadgeText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* footer encouragement */}
        <View style={styles.encourageWrap}>
          <HBCard depth="sm" style={styles.encourage}>
            <View style={styles.encourageIcon}>
              <Text style={{ fontSize: 18 }}>🏅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.encourageTitle}>
                {isRu
                  ? `${score} из ${roundIndex + (answerState !== 'idle' ? 1 : 0)} правильно`
                  : `${score} of ${roundIndex + (answerState !== 'idle' ? 1 : 0)} correct`}
              </Text>
              <Text style={styles.encourageSub}>
                {isRu ? `Из дня ${currentRound.fromDay}` : `From day ${currentRound.fromDay}`}
              </Text>
            </View>
          </HBCard>
        </View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: 50,
  },
  emptyRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  testChipText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  heartsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  heartsText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.berry,
  },

  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing[3],
  },
  petCorner: {
    position: 'absolute',
    right: spacing[5],
    top: 96,
    width: 56,
    height: 56,
    zIndex: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgDeep,
  },

  promptArea: {
    alignItems: 'center',
    marginTop: spacing[5],
    gap: spacing[1],
  },
  kicker: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    letterSpacing: 1.6,
  },
  word: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    color: colors.ink,
    letterSpacing: -0.5,
  },
  soundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.full,
    marginTop: spacing[1],
    ...shadow.sm,
  },
  soundText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },

  optionsGrid: {
    marginTop: spacing[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    justifyContent: 'center',
  },
  optionTile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  optionEmoji: { fontSize: 56 },
  optionText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  optionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
  },

  encourageWrap: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[6],
  },
  encourage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  encourageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encourageTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  encourageSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
  },

  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  scoreText: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(72),
    color: colors.primary,
  },
  completeTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  completeSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
