import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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

import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { buildWordGameWithReviews, pickReviewRounds } from '@/services/spacedRepetition';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

const OPTION_COLORS = [
  { bg: '#EEF4FF', border: '#4A8AFF', text: '#4A8AFF' },
  { bg: '#FFF0F9', border: '#FF6B9D', text: '#FF6B9D' },
  { bg: '#FFFBEA', border: '#FFCB47', text: '#D4A017' },
  { bg: '#EDFCF5', border: '#58E0B8', text: '#1A8C66' },
];

type AnswerState = 'idle' | 'correct' | 'wrong';

export default function WordGameScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1' } = useLocalSearchParams<{ lang: string; day: string }>();
  const lesson = getLesson(lang, Number(day));
  // Mix in 1-2 review rounds from past days (spaced repetition)
  const todayRounds = lesson?.wordGame ?? [];
  const reviewRounds = pickReviewRounds(lang, Number(day));
  const rounds = buildWordGameWithReviews(todayRounds, reviewRounds);

  const [roundIndex, setRoundIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const recordLessonError = useSettings((s) => s.recordLessonError);

  const shakeX = useSharedValue(0);
  const cardScale = useSharedValue(1);

  // Non-null: guard render below ensures rounds is non-empty before this runs
  const currentRound = (rounds[roundIndex] ?? rounds[0])!;
  const isRu = lang === 'ru';

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: cardScale.value }],
  }));

  const handleOption = (option: string) => {
    if (answerState !== 'idle') return;
    setSelectedOption(option);

    if (option === currentRound.correct) {
      setAnswerState('correct');
      setCorrectCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      cardScale.value = withSequence(withSpring(1.04, { damping: 8 }), withSpring(1));

      setTimeout(() => {
        if (roundIndex < rounds.length - 1) {
          setRoundIndex((i) => i + 1);
          setAnswerState('idle');
          setSelectedOption(null);
        } else {
          // All rounds done — go to grammar quest
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push({ pathname: '/lesson/grammar' as any, params: { lang, day } });
        }
      }, 900);
    } else {
      setAnswerState('wrong');
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
      }, 700);
    }
  };

  if (!currentRound) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.cream, colors.parchment, '#F0E8FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative blob */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={styles.progressDots}>
          {rounds.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === roundIndex && styles.progressDotActive,
                i < roundIndex && styles.progressDotDone,
              ]}
            />
          ))}
        </View>
        <View style={[styles.scorePill, shadow.sm]}>
          <Text style={{ fontSize: 16 }}>⭐</Text>
          <Text style={styles.scoreText}>{correctCount * 4}</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.titleArea}>
        <Text style={styles.roundLabel}>
          {isRu ? `Раунд ${roundIndex + 1} из ${rounds.length}` : `Round ${roundIndex + 1} of ${rounds.length}`}
        </Text>
        <Text style={styles.instruction}>
          {isRu ? 'Выбери правильное слово!' : 'Choose the right word!'}
        </Text>
      </Animated.View>

      {/* Emoji hint */}
      <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.emojiArea}>
        <Animated.View style={[styles.emojiCard, shadow.md, cardStyle]}>
          <Text style={styles.hintEmoji}>{currentRound.emoji}</Text>
          {answerState === 'correct' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.correctBadge}>
              <Text style={{ fontSize: 20 }}>✅</Text>
            </Animated.View>
          )}
          {answerState === 'wrong' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.wrongBadge}>
              <Text style={{ fontSize: 20 }}>❌</Text>
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>

      {/* Options grid */}
      <Animated.View entering={FadeInUp.duration(600).delay(300)} style={styles.optionsGrid}>
        {currentRound.options.map((option, i) => {
          const palette = (OPTION_COLORS[i % OPTION_COLORS.length] ?? OPTION_COLORS[0])!;
          const isSelected = selectedOption === option;
          const isCorrect = isSelected && answerState === 'correct';
          const isWrong = isSelected && answerState === 'wrong';

          const bgColor = isCorrect
            ? '#E8FBF5'
            : isWrong
            ? '#FFF0F0'
            : isSelected
            ? palette.bg
            : colors.white;

          const borderColor = isCorrect
            ? colors.accent
            : isWrong
            ? colors.error
            : isSelected
            ? palette.border
            : colors.border;

          const textColor = isCorrect
            ? '#1A8C66'
            : isWrong
            ? colors.error
            : palette.text;

          return (
            <OptionButton
              key={`${roundIndex}-${option}`}
              label={option}
              bgColor={bgColor}
              borderColor={borderColor}
              textColor={textColor}
              onPress={() => handleOption(option)}
              disabled={answerState !== 'idle'}
            />
          );
        })}
      </Animated.View>

      {/* Feedback banner */}
      {answerState !== 'idle' && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[
            styles.feedbackBanner,
            answerState === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}
        >
          <Text style={styles.feedbackText}>
            {answerState === 'correct'
              ? (isRu ? '🎉 Верно!' : '🎉 Correct!')
              : (isRu ? '🙈 Попробуй ещё!' : '🙈 Try again!')}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

interface OptionButtonProps {
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  onPress: () => void;
  disabled: boolean;
}

function OptionButton({ label, bgColor, borderColor, textColor, onPress, disabled }: OptionButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, styles.optionWrap, shadow.sm]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        style={[
          styles.optionBtn,
          { backgroundColor: bgColor, borderColor },
        ]}
      >
        <Text style={[styles.optionText, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },

  blobTop: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: colors.primarySoft,
    opacity: 0.6,
    top: -120,
    right: -80,
  },
  blobBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: colors.englishLight,
    opacity: 0.5,
    bottom: -100,
    left: -80,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[14],
    paddingBottom: spacing[2],
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 28,
    borderRadius: 5,
  },
  progressDotDone: {
    backgroundColor: colors.accent,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.white,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  scoreText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.base,
    color: colors.ink,
  },

  titleArea: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  roundLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[1],
  },
  instruction: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },

  emojiArea: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  emojiCard: {
    width: 130,
    height: 130,
    borderRadius: radius['2xl'],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintEmoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  correctBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  wrongBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
  },

  optionsGrid: {
    paddingHorizontal: spacing[5],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    justifyContent: 'center',
  },
  optionWrap: {
    width: '45%',
  },
  optionBtn: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  optionText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },

  feedbackBanner: {
    position: 'absolute',
    bottom: spacing[10],
    left: spacing[6],
    right: spacing[6],
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    alignItems: 'center',
    ...shadow.md,
  },
  feedbackCorrect: {
    backgroundColor: '#E8FBF5',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  feedbackWrong: {
    backgroundColor: '#FFF0F0',
    borderWidth: 2,
    borderColor: colors.error,
  },
  feedbackText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
});
