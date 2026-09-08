/**
 * Honeybear · Lesson Complete (Reward).
 *
 * Soft confetti on the warm-cream surface, Хани basking in a butter-halo,
 * stats card (stars / words / accuracy), new-badge callout, tomorrow's
 * preview, and a primary "Talk with Bobo" CTA.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as StoreReview from 'expo-store-review';

import { AnimatedCount } from '@/components/AnimatedCount';
import { DieCutBadge } from '@/components/DieCutBadge';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';

import { localOffsetMinutes } from '@soz/shared-types';

import { getLesson } from '@/data/lessons';
import { recordProgress } from '@/services/api';
import { track } from '@/services/analytics';
import { HOUSE_ITEMS } from '@/services/boboHouse';
import {
  ensureWeekCached,
  triggerWeekGeneration,
} from '@/services/generatedLessons';
import { notifyWeekReady, scheduleParentEveningDigest } from '@/services/notifications';
import { playSfx } from '@/services/sfx';
import { enqueueProgress } from '@/services/progressQueue';
import { useSettings } from '@/store/settings';
import { isMatureLearner } from '@/utils/lessonFlow';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI_COLORS = ['#E8945A', '#7AC9B5', '#F5D466', '#E55C73'];

interface ConfettiProps {
  x: number;
  delay: number;
  color: string;
  rotation: number;
  size: number;
}

function Confetti({ x, delay, color, rotation, size }: ConfettiProps) {
  const y = useSharedValue(-60);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(rotation);

  useEffect(() => {
    y.value = withDelay(delay, withTiming(SH + 60, { duration: 2600 + Math.random() * 600 }));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(1800, withTiming(0, { duration: 400 })),
    ));
    rotate.value = withDelay(delay, withTiming(rotation + 720, { duration: 3000 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: 0,
          width: size,
          height: size * 0.35,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

export default function LessonCompleteScreen() {
  const router = useRouter();
  const { lang = 'en', day = '1', stars: starsParam } = useLocalSearchParams<{
    lang: string;
    day: string;
    stars?: string;
  }>();
  const lesson = getLesson(lang, Number(day));
  const reward = lesson?.reward ?? { stars: 12, message: '' };
  const stars = starsParam ? Number(starsParam) : reward.stars;

  const addStars = useSettings((s) => s.addStars);
  const advanceDay = useSettings((s) => s.advanceDay);
  const markTodayComplete = useSettings((s) => s.markTodayComplete);
  const claimLessonCredit = useSettings((s) => s.claimLessonCredit);
  const applyServerProgress = useSettings((s) => s.applyServerProgress);
  const authToken = useSettings((s) => s.authToken);
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName);
  const parentLang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const bot = useCompanionName();
  const currentLessonErrors = useSettings((s) => s.currentLessonErrors);

  const isRu = lang === 'ru';

  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: Math.random() * SW,
        delay: i * 90 + Math.random() * 200,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        rotation: Math.random() * 360,
        size: 10 + Math.random() * 8,
      })),
    [],
  );

  const counterScale = useSharedValue(0.4);

  useEffect(() => {
    playSfx('fanfare');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const dayNum = Number(day);

    // Award exactly once per (child, language, day). This effect runs on mount
    // with no dependencies, so navigating back into the completion screen used to
    // re-award the stars and advance the day AGAIN — skipping the next day
    // entirely. The server enforces the same key; this keeps the local mirror
    // honest and avoids a pointless round-trip.
    const firstTime = childId ? claimLessonCredit(childId, lang, dayNum) : true;

    // Optimistic local update so the screen is correct instantly and offline.
    // The server's numbers replace these below the moment the POST lands.
    const tz = localOffsetMinutes();
    if (firstTime) {
      addStars(stars);
      markTodayComplete(tz);
      advanceDay(dayNum);
    }

    track({ event: 'lesson_complete', userId, childId, props: { lang, day: dayNum, stars } });

    // Read the streak AFTER markTodayComplete rather than `streak + 1`: the value
    // captured at mount is stale, and a second lesson on the same day doesn't
    // increment at all — the old arithmetic celebrated milestones that hadn't
    // happened and missed ones that had.
    const newStreak = useSettings.getState().streak;
    const MILESTONES = [3, 5, 7, 14, 30];
    if (firstTime && MILESTONES.includes(newStreak)) {
      track({ event: 'streak_milestone', userId, childId, props: { streak: newStreak } });
      setTimeout(() => {
        router.push(`/lesson/milestone?streak=${newStreak}&lang=${lang}&day=${day}` as any);
      }, 2200);
    }

    if (authToken && childId && firstTime) {
      const entry = {
        childId,
        language: lang,
        day: dayNum,
        starsEarned: stars,
        errors: currentLessonErrors,
        tzOffsetMinutes: tz,
      };
      // Deliver now; on failure the completion is queued and retried on the next
      // launch instead of being dropped. A lesson finished on the metro used to
      // vanish, and the next hydrate pulled the server's older totals back over
      // the local ones — the lesson visibly un-completed itself.
      recordProgress(entry, authToken)
        .then((result) => applyServerProgress(result))
        .catch(() => enqueueProgress({ ...entry, queuedAt: Date.now() }));
    }

    const wordsLearned = lesson?.vocabulary.length ?? 0;
    scheduleParentEveningDigest(childName ?? '', stars, wordsLearned, parentLang === 'az').catch(() => {});

    const dayN = Number(day);
    const isWeekBoundary = dayN === 30 || (dayN > 30 && (dayN - 30) % 7 === 0);
    if (isWeekBoundary && authToken && childId) {
      triggerWeekGeneration(childId, lang, authToken)
        .then(async (result) => {
          if (result.ok && !result.alreadyGenerated) {
            await ensureWeekCached(childId, lang, dayN + 1, authToken).catch(() => {});
            await notifyWeekReady(childName ?? '', parentLang === 'az').catch(() => {});
            track({ event: 'streak_milestone', userId, childId, props: { kind: 'week_generated', day: dayN } });
          }
        })
        .catch(() => {});
    }

    if (Number(day) === 3) {
      StoreReview.isAvailableAsync().then((available) => {
        if (available) StoreReview.requestReview().catch(() => {});
      }).catch(() => {});
    }

    counterScale.value = withDelay(600, withSpring(1, { damping: 8 }));
  }, []);

  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: counterScale.value }],
  }));

  const handleHome = () => router.replace('/home');
  const handleTalkMore = () => router.push(`/talk?lang=${lang}&day=${day}`);

  const wordsLearned = lesson?.vocabulary.length ?? 5;
  const accuracy = currentLessonErrors.length === 0 ? 100 : Math.max(50, 100 - currentLessonErrors.length * 8);

  const collectible = (() => {
    const completedDay = Number(day);
    return HOUSE_ITEMS.find((it) => it.unlockDay === completedDay);
  })();

  const tomorrow = (() => {
    const nextDay = Number(day) + 1;
    if (nextDay > 30) return null;
    // Teens/B1+ follow the text-first flow — tease that, not kid game modes.
    const s = useSettings.getState();
    if (isMatureLearner(s.childLevel, s.childAgeBand)) {
      return isRu
        ? { emoji: '📚', name: `Текст и разговор с ${bot}` }
        : { emoji: '📚', name: `Reading & talk with ${bot}` };
    }
    const LESSON_MODES = ['quest', 'tpr', 'pretend', 'world'] as const;
    const LABELS_RU = {
      quest: { emoji: '🗺️', name: 'Приключение' },
      tpr: { emoji: '⚡', name: `Двигайся с ${bot}` },
      pretend: { emoji: '🎭', name: 'Ролевая игра' },
      world: { emoji: '🌍', name: 'Покажи свой мир' },
    };
    const LABELS_EN = {
      quest: { emoji: '🗺️', name: 'Quest' },
      tpr: { emoji: '⚡', name: `Move with ${bot}` },
      pretend: { emoji: '🎭', name: 'Pretend Play' },
      world: { emoji: '🌍', name: 'Show Your World' },
    };
    const mode = LESSON_MODES[(nextDay - 1) % 4]!;
    const labels = isRu ? LABELS_RU : LABELS_EN;
    return labels[mode];
  })();

  return (
    <PaperBackground variant="honey">
      {/* confetti layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {confetti.map((c) => (
          <Confetti key={c.id} {...c} />
        ))}
      </View>

      <View style={styles.content}>
        {/* Хани with butter halo */}
        <Animated.View entering={FadeInDown.duration(700)} style={styles.petWrap}>
          <View style={styles.halo}>
            <HBPet size={150} mood="happy" />
          </View>
        </Animated.View>

        {/* Counter */}
        <Animated.View style={[styles.counterWrap, counterStyle]}>
          <Text style={styles.plusText}>+</Text>
          <AnimatedCount value={stars} delay={600} duration={900} tickSound style={styles.counterText} />
          <Text style={styles.starIcon}>⭐</Text>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.titleArea}>
          <Text style={styles.kicker}>
            {isRu ? 'УРОК ЗАВЕРШЁН!' : 'LESSON COMPLETE!'}
          </Text>
          <Text style={styles.title}>
            {isRu ? 'Великолепно!' : 'Great job!'}
          </Text>
          {reward.message ? <Text style={styles.message}>{reward.message}</Text> : null}
        </Animated.View>

        {/* Stats card */}
        <Animated.View entering={FadeInUp.duration(500).delay(600)} style={{ width: '100%' }}>
          <HBCard style={styles.statsCard} depth="md">
            <View style={styles.statCol}>
              <Text style={[styles.statIcon, { color: colors.butter }]}>⭐</Text>
              <Text style={[styles.statValue, { color: colors.butterDeep }]}>+{stars}</Text>
              <Text style={styles.statLabel}>
                {isRu ? 'Звёзды' : 'Stars'}
              </Text>
            </View>
            <View style={styles.dashedRule} />
            <View style={styles.statCol}>
              <Text style={styles.statIcon}>📖</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>{wordsLearned}</Text>
              <Text style={styles.statLabel}>
                {isRu ? 'Слова' : 'Words'}
              </Text>
            </View>
            <View style={styles.dashedRule} />
            <View style={styles.statCol}>
              <Text style={styles.statIcon}>✓</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{accuracy}%</Text>
              <Text style={styles.statLabel}>
                {isRu ? 'Точность' : 'Accuracy'}
              </Text>
            </View>
          </HBCard>
        </Animated.View>

        {/* Collectible badge */}
        {collectible ? (
          <Animated.View entering={FadeInUp.duration(500).delay(700)} style={{ width: '100%' }}>
            <HBCard style={styles.collectibleCard} depth="sm" bg={tints.butter}>
              <DieCutBadge size={46} tilt={-6} edge={3} bg={colors.butter} delay={750}>
                <Text style={{ fontSize: 22 }}>{collectible.emoji}</Text>
              </DieCutBadge>
              <View style={{ flex: 1 }}>
                <Text style={styles.collectibleTitle}>
                  {isRu ? 'Новый значок!' : 'New badge!'}
                </Text>
                <Pressable onPress={() => router.push('/bobo-house' as any)}>
                  <Text style={styles.collectibleSub}>
                    {collectible.nameRu} · {isRu ? 'смотреть дом →' : 'see house →'}
                  </Text>
                </Pressable>
              </View>
            </HBCard>
          </Animated.View>
        ) : null}

        {/* Tomorrow */}
        {tomorrow ? (
          <Animated.View entering={FadeInUp.duration(500).delay(800)} style={{ width: '100%' }}>
            <HBCard style={styles.tomorrowCard} depth="sm">
              <Text style={styles.tomorrowLabel}>
                {isRu ? 'ЗАВТРА' : 'TOMORROW'}
              </Text>
              <View style={styles.tomorrowRow}>
                <Text style={{ fontSize: 22 }}>{tomorrow.emoji}</Text>
                <Text style={styles.tomorrowName}>{tomorrow.name}</Text>
              </View>
            </HBCard>
          </Animated.View>
        ) : null}

        {/* CTAs */}
        <Animated.View entering={FadeInUp.duration(500).delay(900)} style={styles.buttons}>
          <HBButton
            full
            variant="primary"
            label={isRu ? `Поговорить с ${bot} →` : `Talk with ${bot} →`}
            onPress={handleTalkMore}
          />
          <Pressable onPress={handleHome} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>
              {isRu ? 'На главную' : 'Go home'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },

  petWrap: { alignItems: 'center' },
  halo: {
    padding: spacing[5],
    borderRadius: 999,
    backgroundColor: 'rgba(245, 212, 102, 0.4)',
  },

  counterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  plusText: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    color: colors.primaryDeep,
    lineHeight: 48,
  },
  counterText: {
    fontFamily: fontFamily.display,
    fontSize: 64,
    color: colors.primary,
    lineHeight: 72,
  },
  starIcon: { fontSize: 36, lineHeight: 44 },

  titleArea: { alignItems: 'center', gap: spacing[1] },
  kicker: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.primaryDeep,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  statsCard: {
    flexDirection: 'row',
    paddingVertical: spacing[3],
  },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 18 },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
  },
  statLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dashedRule: {
    width: 1,
    backgroundColor: colors.bgDeep,
    marginVertical: spacing[1],
  },

  collectibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  collectibleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.butter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectibleTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  collectibleSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  tomorrowCard: {
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
  },
  tomorrowLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 1.5,
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tomorrowName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },

  buttons: {
    width: '100%',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  ghostBtn: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
