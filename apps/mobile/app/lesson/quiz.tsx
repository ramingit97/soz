/**
 * Контрольная: слова последней недели — выбрать картинку к слову.
 *
 * Картинки без подписей: раньше под каждой было её слово, и ответ находился
 * совпадением надписей. Картинка варианта берётся из его собственного раунда —
 * раньше искалась в раунде, где слово было лишь одним из вариантов, и у
 * неверного ответа могла оказаться картинка верного. Тексты — на языке
 * интерфейса (RU/AZ).
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
import { Icon } from '@/components/Icon';
import { LessonHeader } from '@/components/LessonHeader';
import { PaperBackground } from '@/components/PaperBackground';
import { ReactingPet, type ReactingPetHandle } from '@/components/ReactingPet';
import { StarParticle } from '@/components/StarParticle';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/hooks/useTheme';
import { fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { byMode, makeModeStyles } from '@/theme/modeTokens';

interface Choice {
  word: string;
  emoji: string;
}

interface QuizRound {
  emoji: string;
  correct: string;
  choices: Choice[];
  fromDay: number;
}

const OPTION_TINTS_BY_MODE = byMode((t) => ([t.c.tints.primary, t.c.tints.butter, t.c.tints.sage, t.c.tints.berry]));

function buildQuiz(lang: string, currentDay: number): QuizRound[] {
  const startDay = Math.max(1, currentDay - 7);
  const allRounds: { emoji: string; correct: string; fromDay: number }[] = [];
  // Картинка каждого слова — из ЕГО раунда.
  const emojiOf = new Map<string, string>();

  for (let d = startDay; d < currentDay; d++) {
    const lesson = getLesson(lang, d);
    if (!lesson?.wordGame) continue;
    for (const r of lesson.wordGame) {
      allRounds.push({ emoji: r.emoji, correct: r.correct, fromDay: d });
      if (!emojiOf.has(r.correct)) emojiOf.set(r.correct, r.emoji);
    }
  }

  const words = [...emojiOf.keys()];
  const picked = [...allRounds].sort(() => Math.random() - 0.5).slice(0, 7);

  return picked.map((r) => {
    const distractors = words
      .filter((w) => w !== r.correct && emojiOf.get(w) !== r.emoji)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((w) => ({ word: w, emoji: emojiOf.get(w)! }));
    const choices = [{ word: r.correct, emoji: r.emoji }, ...distractors].sort(() => Math.random() - 0.5);
    return { ...r, choices };
  });
}

export default function QuizScreen() {
  const router = useRouter();
  const { lang = 'en', endDay = '7' } = useLocalSearchParams<{ lang: string; endDay: string }>();
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  const OPTION_TINTS = OPTION_TINTS_BY_MODE[uiMode];
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

  const title = az ? 'Yoxlama' : 'Контрольная';

  if (rounds.length === 0) {
    return (
      <PaperBackground edges={['top', 'bottom']}>
        <View style={[styles.center, { paddingHorizontal: t.density.padX }]}>
          <HBPet size={t.mascot.hero} mood="curious" />
          <Text variant="body" tone="secondary" align="center">
            {az ? 'Yoxlama üçün hələ söz yoxdur.' : 'Для контрольной пока нет слов.'}
          </Text>
          <HBButton icon="house" label={az ? 'Ana səhifəyə' : 'На главную'} onPress={() => router.replace('/home')} />
        </View>
      </PaperBackground>
    );
  }

  if (done) {
    const total = rounds.length;
    const percentage = Math.round((score / total) * 100);
    return (
      <PaperBackground edges={['top', 'bottom']}>
        <View style={[styles.center, { paddingHorizontal: t.density.padX }]}>
          <Animated.View entering={FadeInDown.duration(600)}>
            <HBPet size={t.mascot.hero} mood="happy" />
          </Animated.View>
          <Animated.View entering={FadeIn.duration(500).delay(250)} style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: accent.ink }]}>
              {score} / {total}
            </Text>
            <Icon name="star" size={32} color={c.butterDeep} fill={c.butter} strokeWidth={2} />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.doneText}>
            <Text variant="title" align="center">{az ? 'Yoxlama bitdi!' : 'Контрольная пройдена!'}</Text>
            <Text variant="body" tone="secondary" align="center">
              {percentage >= 80
                ? az ? 'Əla yaddaş!' : 'Отличная память!'
                : percentage >= 50
                  ? az ? 'Yaxşı iş!' : 'Хорошая работа!'
                  : az ? 'Belə davam et!' : 'Так держать!'}
            </Text>
          </Animated.View>
          <HBButton full icon="house" label={az ? 'Ana səhifəyə' : 'На главную'} onPress={() => router.replace('/home')} />
        </View>
      </PaperBackground>
    );
  }

  if (!currentRound) return null;

  return (
    <PaperBackground>
      <LessonHeader
        title={title}
        icon="graduation-cap"
        step={roundIndex + 1}
        total={rounds.length}
        onClose={() => router.back()}
        right={
          <View style={styles.hearts} accessibilityLabel={az ? `Ürəklər: ${hearts}` : `Сердечки: ${hearts}`}>
            <Icon name="heart" size={16} color={c.berry} fill={c.berry} strokeWidth={2} />
            <Text style={styles.heartsText}>{hearts}</Text>
          </View>
        }
      />

      <View style={[styles.body, { paddingHorizontal: t.density.padX }]}>
        {/* персонаж подбадривает — поверх, чтобы раскладка не прыгала */}
        <View pointerEvents="none" style={styles.petCorner}>
          <ReactingPet ref={petRef} size={56} hue={petHue} mood="curious" />
          {petStars.map((id) => (
            <StarParticle key={id} x={4 + (id % 3) * 16} y={-4} delay={(id % 2) * 120} />
          ))}
        </View>

        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.prompt}>
          <Text variant="label" tone="secondary">{az ? 'Şəkli seç' : 'Выбери картинку'}</Text>
          <Text style={styles.word}>{currentRound.correct}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(160)} style={styles.grid}>
          {currentRound.choices.map((choice, i) => {
            const isSelected = selected === choice.word;
            const isCorrect = isSelected && answerState === 'correct';
            const isWrong = isSelected && answerState === 'wrong';
            const ring = isCorrect ? c.accentDeep : isWrong ? c.berry : undefined;
            return (
              <Pressable
                key={`${roundIndex}-${choice.word}`}
                onPress={() => handleOption(choice.word)}
                disabled={answerState !== 'idle'}
                accessibilityRole="button"
                accessibilityLabel={choice.emoji}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: OPTION_TINTS[i % OPTION_TINTS.length] },
                  ring ? { borderColor: ring, borderWidth: 3 } : null,
                  pressed && styles.pressed,
                ]}
              >
                <Animated.View style={cardStyle}>
                  <Text style={styles.tileEmoji}>{choice.emoji}</Text>
                </Animated.View>
                {isCorrect || isWrong ? (
                  <View style={[styles.badge, { backgroundColor: isCorrect ? c.accentDeep : c.berry }]}>
                    <Icon name={isCorrect ? 'check' : 'x'} size={14} color={c.white} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>

        <HBCard style={styles.footer}>
          <Icon name="medal" size={20} color={accent.ink} />
          <View style={styles.flex}>
            <Text variant="bodyBold">
              {az
                ? `${roundIndex + (answerState !== 'idle' ? 1 : 0)}-dən ${score} düz`
                : `${score} из ${roundIndex + (answerState !== 'idle' ? 1 : 0)} правильно`}
            </Text>
            <Text variant="caption" tone="secondary">
              {az ? `${currentRound.fromDay}-ci gündən` : `Из дня ${currentRound.fromDay}`}
            </Text>
          </View>
        </HBCard>
      </View>
    </PaperBackground>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  scoreText: { fontFamily: fontFamily.display, fontSize: scaleFont(48), lineHeight: scaleFont(56) },
  doneText: { alignItems: 'center', gap: spacing[1] },
  hearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
  },
  heartsText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm, color: t.c.ink },
  body: { flex: 1, paddingTop: spacing[4], paddingBottom: spacing[6], gap: spacing[5] },
  petCorner: { position: 'absolute', right: spacing[4], top: 0, zIndex: 5 },
  prompt: { alignItems: 'center', gap: spacing[1] },
  word: { fontFamily: fontFamily.display, fontSize: fontSize['4xl'], color: t.c.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[3] },
  tile: {
    width: '48.5%',
    aspectRatio: 1.15,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  tileEmoji: { fontSize: scaleFont(52), lineHeight: scaleFont(64) },
  badge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: 'auto' },
  flex: { flex: 1, minWidth: 0 },
}));
