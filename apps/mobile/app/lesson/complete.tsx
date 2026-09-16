/**
 * Урок выполнен — награда.
 *
 * Звёзды начисляются один раз на (ребёнок, язык, день); прогресс уходит на
 * сервер, при сбое — в очередь. Экран: персонаж, счётчик звёзд, итоги урока,
 * после первого дня — вопрос про напоминания, значок для дома персонажа, что
 * будет завтра, и дальше разговор или главный.
 *
 * Язык — интерфейса (RU/AZ): раньше для изучающих английский здесь было
 * «LESSON COMPLETE!». Прокручивается: на 320×712 содержимое не влезало.
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as StoreReview from 'expo-store-review';

import { AnimatedCount } from '@/components/AnimatedCount';
import { DieCutBadge } from '@/components/DieCutBadge';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';

import { localOffsetMinutes } from '@soz/shared-types';

import { getLesson } from '@/data/lessons';
import { useTheme } from '@/hooks/useTheme';
import { recordProgress } from '@/services/api';
import { track } from '@/services/analytics';
import { HOUSE_ITEMS } from '@/services/boboHouse';
import {
  ensureWeekCached,
  triggerWeekGeneration,
} from '@/services/generatedLessons';
import {
  canAskNotificationPermission,
  notifyWeekReady,
  requestNotificationPermission,
  scheduleLessonReminders,
  scheduleParentEveningDigest,
} from '@/services/notifications';
import { playSfx } from '@/services/sfx';
import { enqueueProgress } from '@/services/progressQueue';
import { useSettings } from '@/store/settings';
import { isMatureLearner, kidModeForDay } from '@/utils/lessonFlow';
import { kidModeLabel } from '@/utils/lessonModes';
import { useCompanionName } from '@/utils/companion';
import { colors, fontFamily, fontSize, scaleFont, spacing, tints } from '@/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI_COLORS = [colors.primary, colors.accent, colors.butter, colors.berry];

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

  const az = parentLang === 'az';
  const scheduleHour = useSettings((s) => s.scheduleHour);
  const scheduleDays = useSettings((s) => s.scheduleDays);
  const { t, accent } = useTheme();
  const insets = useSafeAreaInsets();

  // Уведомления спрашиваем после первого урока: экран разрешения из онбординга
  // убран, а после урока понятно, о чём напоминать.
  const [askNotify, setAskNotify] = useState(false);
  useEffect(() => {
    if (Number(day) !== 1) return;
    let alive = true;
    canAskNotificationPermission().then((can) => { if (alive) setAskNotify(can); });
    return () => { alive = false; };
  }, [day]);

  const confetti = useMemo(
    () =>
      Array.from({ length: t.confetti }, (_, i) => ({
        id: i,
        x: Math.random() * SW,
        delay: i * 90 + Math.random() * 200,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        rotation: Math.random() * 360,
        size: 10 + Math.random() * 8,
      })),
    // Количество — из режима при открытии экрана; менять его на ходу незачем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAllowNotify = async () => {
    Haptics.selectionAsync().catch(() => {});
    setAskNotify(false);
    try {
      if (await requestNotificationPermission()) {
        await scheduleLessonReminders(childName || (az ? 'Uşaq' : 'Ребёнок'), scheduleHour, scheduleDays, az);
      }
    } catch {
      /* отказ или сбой — просто не напоминаем */
    }
  };

  const wordsLearned = lesson?.vocabulary.length ?? 5;
  const accuracy = currentLessonErrors.length === 0 ? 100 : Math.max(50, 100 - currentLessonErrors.length * 8);

  const collectible = HOUSE_ITEMS.find((it) => it.unlockDay === Number(day));

  const tomorrow: { icon: IconName; name: string } | null = (() => {
    const nextDay = Number(day) + 1;
    if (nextDay > 30) return null;
    // Старшие идут по тексту — это и показываем, а не игровые режимы малышей.
    const s = useSettings.getState();
    if (isMatureLearner(s.childLevel, s.childAgeBand)) {
      return { icon: 'book-open', name: az ? `Mətn və ${bot} ilə söhbət` : `Текст и разговор с ${bot}` };
    }
    return kidModeLabel(kidModeForDay(nextDay), az, bot);
  })();

  return (
    <PaperBackground>
      {/* конфетти */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {confetti.map((c) => (
          <Confetti key={c.id} {...c} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[6], paddingHorizontal: t.density.padX, gap: t.density.gap },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.petWrap}>
          <View style={[styles.halo, { backgroundColor: accent.soft }]}>
            <HBPet size={t.mascot.hero} mood="happy" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.counterWrap, counterStyle]}>
          <Text style={[styles.plusText, { color: accent.ink }]}>+</Text>
          <AnimatedCount value={stars} delay={600} duration={900} tickSound style={[styles.counterText, { color: accent.ink }]} />
          <Icon name="star" size={40} color={colors.butterDeep} fill={colors.butter} strokeWidth={2} />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.titleArea}>
          <Text variant="label" style={{ color: accent.ink }}>
            {az ? 'Dərs bitdi' : 'Урок выполнен'}
          </Text>
          <Text variant="title" align="center">
            {az ? 'Əla!' : 'Великолепно!'}
          </Text>
          {/* Подпись награды написана на языке урока: показываем, только если
              ребёнок её прочитает (русский урок при русском интерфейсе). */}
          {reward.message && lang === 'ru' && !az ? (
            <Text variant="caption" tone="secondary" align="center" style={styles.message}>
              {reward.message}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(450).delay(550)}>
          <HBCard style={styles.statsCard}>
            <Stat icon="star" color={colors.butterDeep} fill={colors.butter} value={`+${stars}`} label={az ? 'Ulduz' : 'Звёзды'} />
            <View style={styles.rule} />
            <Stat icon="book-open" color={accent.ink} value={String(wordsLearned)} label={az ? 'Söz' : 'Слова'} />
            <View style={styles.rule} />
            <Stat icon="target" color={colors.accentDeep} value={`${accuracy}%`} label={az ? 'Dəqiqlik' : 'Точность'} />
          </HBCard>
        </Animated.View>

        {askNotify ? (
          <Animated.View entering={FadeInUp.duration(450).delay(650)} exiting={FadeOut.duration(150)}>
            <HBCard bg={accent.soft} style={styles.notifyCard}>
              <View style={styles.row}>
                <HBIconBox icon="bell" tint={colors.surface} iconColor={accent.ink} size={40} />
                <View style={styles.flex}>
                  <Text variant="bodyBold">
                    {az ? `${bot} dərsi xatırlatsın?` : `${bot} будет напоминать про урок?`}
                  </Text>
                  <Text variant="caption" style={{ color: colors.ink }}>
                    {az
                      ? `Hər gün saat ${scheduleHour}:00-da — seriya qırılmasın.`
                      : `Каждый день в ${scheduleHour}:00 — чтобы не терять серию.`}
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                <HBButton size="sm" variant="soft" label={az ? 'Sonra' : 'Не сейчас'} onPress={() => setAskNotify(false)} style={styles.flex} />
                <HBButton size="sm" icon="bell" label={az ? 'İcazə ver' : 'Разрешить'} onPress={handleAllowNotify} style={styles.flex} />
              </View>
            </HBCard>
          </Animated.View>
        ) : null}

        {collectible ? (
          <Animated.View entering={FadeInUp.duration(450).delay(700)}>
            <Pressable onPress={() => router.push('/bobo-house' as any)} accessibilityRole="button">
              <HBCard bg={tints.butter} style={styles.row}>
                <DieCutBadge size={46} tilt={-6} edge={3} bg={colors.butter} delay={750}>
                  <Text style={styles.collectibleEmoji}>{collectible.emoji}</Text>
                </DieCutBadge>
                <View style={styles.flex}>
                  <Text variant="bodyBold">{az ? 'Yeni nişan!' : 'Новый значок!'}</Text>
                  <Text variant="caption" tone="secondary">
                    {az ? collectible.nameAz : collectible.nameRu}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.inkSoft} />
              </HBCard>
            </Pressable>
          </Animated.View>
        ) : null}

        {tomorrow ? (
          <Animated.View entering={FadeInUp.duration(450).delay(800)}>
            <HBCard style={styles.row}>
              <HBIconBox icon={tomorrow.icon} tint={accent.soft} iconColor={accent.ink} size={40} />
              <View style={styles.flex}>
                <Text variant="label" tone="secondary">
                  {az ? 'Sabah' : 'Завтра'}
                </Text>
                <Text variant="bodyBold">{tomorrow.name}</Text>
              </View>
            </HBCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.duration(450).delay(900)} style={styles.buttons}>
          <HBButton full icon="message-circle" label={az ? `${bot} ilə danış` : `Поговорить с ${bot}`} onPress={handleTalkMore} />
          <HBButton full variant="ghost" label={az ? 'Ana səhifəyə' : 'На главную'} onPress={handleHome} />
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

function Stat({ icon, color, fill, value, label }: { icon: IconName; color: string; fill?: string; value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Icon name={icon} size={20} color={color} fill={fill} strokeWidth={2.25} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing[8] },

  petWrap: { alignItems: 'center' },
  halo: { padding: spacing[4], borderRadius: 999 },

  counterWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1] },
  plusText: { fontFamily: fontFamily.display, fontSize: fontSize['4xl'], lineHeight: scaleFont(48) },
  counterText: { fontFamily: fontFamily.display, fontSize: scaleFont(56), lineHeight: scaleFont(64) },

  titleArea: { alignItems: 'center', gap: spacing[1] },
  message: { maxWidth: 300 },

  statsCard: { flexDirection: 'row', paddingVertical: spacing[3] },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fontFamily.display, fontSize: fontSize.xl },
  rule: { width: 1, backgroundColor: colors.bgDeep, marginVertical: spacing[1] },

  notifyCard: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  collectibleEmoji: { fontSize: scaleFont(22), lineHeight: scaleFont(28) },

  buttons: { gap: spacing[1], marginTop: spacing[2] },
});
