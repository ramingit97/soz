/**
 * Honeybear · Home — world map + today's lesson.
 *
 * The flagship screen of the Honeybear design: warm cream paper, Хани mascot
 * in the top bar, claymorphism lesson card with chapter ornament, and a curved
 * path of theme nodes (done / current / locked) reminiscent of the design's
 * "world map".
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBChip } from '@/components/HBChip';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { getLessonThemes, getLesson, STATIC_MAX_DAY } from '@/data/lessons';
import { WORLDS, worldForDay, worldLabel } from '@/data/worlds';
import { useBedtime } from '@/hooks/useBedtime';
import { track } from '@/services/analytics';
import {
  ensureWeekCached,
  triggerWeekGeneration,
  weekStartFor,
} from '@/services/generatedLessons';
import { fetchCurriculumLesson, getCachedCurriculumLesson } from '@/services/curriculum';
import { getThreads, type MemoryThread } from '@/services/api';
import { scheduleFriendCallbacks, scheduleStreakRiskReminder } from '@/services/notifications';
import { FREE_DAYS } from '@/services/subscriptions';
import { localDateISO, localOffsetMinutes, localYesterdayISO } from '@soz/shared-types';
import { useSettings, todayISO } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useAccent } from '@/hooks/useAccent';
import { useCompanionName, withCompanionName } from '@/utils/companion';
import { isMatureLearner, lessonEntryRoute } from '@/utils/lessonFlow';

declare const __DEV__: boolean;

// ─── Zigzag path node ────────────────────────────────────────────────────────

const ZIGZAG_POS = ['right', 'center', 'left', 'center', 'right', 'center', 'left', 'center', 'right'] as const;
type ZigPos = typeof ZIGZAG_POS[number];

function ZigzagNode({
  day,
  isDone,
  isCurrent,
  isPremiumLocked,
  isLockedByOrder,
  worldColor,
  worldTint,
  position,
  isAz,
  isLast,
  onPress,
  startLabel,
  themeEmoji,
}: {
  day: number;
  isDone: boolean;
  isCurrent: boolean;
  isPremiumLocked: boolean;
  isLockedByOrder: boolean;
  worldColor: string;
  worldTint: string;
  position: ZigPos;
  isAz: boolean;
  isLast: boolean;
  onPress?: () => void;
  startLabel?: string;
  /** AI-plan theme emoji — previewed on order-locked nodes instead of 🔒. */
  themeEmoji?: string;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isCurrent) {
      pulse.value = withRepeat(
        withSequence(withSpring(1.14, { damping: 5 }), withSpring(1, { damping: 8 })),
        -1,
        true,
      );
    } else {
      pulse.value = 1;
    }
  }, [isCurrent]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const justify = position === 'left' ? 'flex-start' : position === 'right' ? 'flex-end' : 'center';

  const nodeStyle = [
    pathStyles.node,
    isDone && { backgroundColor: worldColor },
    isCurrent && { backgroundColor: worldColor, borderWidth: 3, borderColor: colors.butter, shadowColor: worldColor, shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
    isPremiumLocked && { backgroundColor: colors.butter + '60', borderColor: colors.butter, borderWidth: 2 },
    isLockedByOrder && { backgroundColor: colors.bgDeep },
  ];

  const emoji = isDone ? '✓' : isCurrent ? '▶' : isPremiumLocked ? '👑' : themeEmoji ?? '🔒';
  const emojiStyle = [
    pathStyles.nodeEmoji,
    isDone && { color: colors.white },
    isCurrent && { color: colors.white, fontSize: fontSize.xl },
    isLockedByOrder && themeEmoji ? { opacity: 0.45 } : null,
  ];

  const labelStyle = [
    pathStyles.nodeLabel,
    isDone && { color: worldColor },
    isCurrent && { color: worldColor, fontFamily: fontFamily.bodyBlack },
    isLockedByOrder && { color: colors.inkSoft, opacity: 0.55 },
  ];

  return (
    <View style={pathStyles.nodeRow}>
      {/* Track dot connector — shows before each node except first */}
      <View style={[pathStyles.trackSlot, { justifyContent: justify }]}>
        <Animated.View style={animStyle}>
          <Pressable onPress={onPress} disabled={!onPress}>
            <View style={nodeStyle}>
              <Text style={emojiStyle}>{emoji}</Text>
            </View>
          </Pressable>
        </Animated.View>
        <Text style={labelStyle}>
          {isAz ? `G${day}` : `Д${day}`}
        </Text>
        {isCurrent && startLabel ? (
          <Text style={{ fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'], color: worldColor, marginTop: 2 }}>
            ▶ {startLabel}
          </Text>
        ) : null}
      </View>
      {/* Connector line to next node (centered) */}
      {!isLast && <View style={pathStyles.connector} />}
    </View>
  );
}

// ─── Adult learner home — a talk-hub instead of the kid lesson flow ──────────

function adultGoalLabel(goal: string | null, isAz: boolean): string {
  const map: Record<string, [string, string]> = {
    travel: ['Путешествия', 'Səyahət'],
    career: ['Работа и карьера', 'İş və karyera'],
    interview: ['Собеседование', 'Müsahibə'],
    move: ['Переезд', 'Köçmək'],
    family: ['Общение с близкими', 'Yaxınlarla ünsiyyət'],
    fun: ['Фильмы и хобби', 'Filmlər və hobbi'],
  };
  const v = goal ? map[goal] : undefined;
  if (!v) return isAz ? 'Dil öyrənmək' : 'Учить язык';
  return isAz ? v[1] : v[0];
}

const ROLEPLAY_BY_GOAL: Record<string, string> = {
  travel: 'Roleplay a travel situation: at the airport, hotel check-in, or asking for directions.',
  career: 'Roleplay a friendly job interview.',
  interview: 'Roleplay a friendly job interview.',
  move: 'Roleplay renting an apartment and talking with a landlord.',
  family: 'Roleplay a warm everyday conversation with a friend.',
  fun: 'Roleplay chatting about movies, music and hobbies.',
};

function AdultHome() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const goal = useSettings((s) => s.goal);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const streak = useSettings((s) => s.streak);
  const totalStars = useSettings((s) => s.totalStars);
  const isPremium = useSettings((s) => s.isPremium);
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const isAz = lang === 'az';
  const learnLang = learningLanguages[0] ?? 'en';

  const go = (mode: string, scenario?: string, premium?: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Roleplay / Debate are premium for adults; free chat stays free.
    if (premium && !isPremium) {
      track({ event: 'paywall_viewed', userId, childId, props: { source: 'adult_mode', mode } });
      router.push('/paywall' as any);
      return;
    }
    track({ event: 'adult_talk_started', userId, childId, props: { mode } });
    const s = scenario ? `&scenario=${encodeURIComponent(scenario)}` : '';
    router.push(`/talk?lang=${learnLang}&day=1${s}` as any);
  };

  const roleplay = ROLEPLAY_BY_GOAL[goal ?? ''] ?? 'Roleplay an everyday small-talk situation.';
  const debate =
    'Friendly debate — pick a fun topic, take a side, and help me argue my points in the language I am learning.';

  const MODES = [
    { key: 'free', emoji: '💬', ru: 'Свободный разговор', az: 'Sərbəst söhbət', subRu: 'Болтай с Хани о чём угодно', subAz: 'Hər mövzuda danış', tint: colors.primary, scenario: undefined as string | undefined, premium: false },
    { key: 'roleplay', emoji: '🎭', ru: 'Ролевая игра', az: 'Rollu oyun', subRu: goal ? 'Сценка по твоей цели' : 'Разыграйте сценку', subAz: 'Səhnə oyna', tint: colors.accent, scenario: roleplay, premium: true },
    { key: 'debate', emoji: '⚖️', ru: 'Дебаты', az: 'Debatlar', subRu: 'Отстаивай свою точку зрения', subAz: 'Fikrini müdafiə et', tint: colors.berry, scenario: debate, premium: true },
  ];

  return (
    <PaperBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
          <View style={[styles.petAvatar, shadow.sm]}>
            <HBPet size={32} eyes={false} hue={175} mood="happy" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tbGreeting}>
              {isAz ? `Salam, ${childName}!` : `Привет, ${childName}!`}
            </Text>
            <Text style={styles.tbSubtitle}>
              {isAz ? 'Bu gün nə üzərində işləyək?' : 'Над чем поработаем сегодня?'}
            </Text>
          </View>
          {streak > 0 && (
            <HBChip label={String(streak)} leadingIcon={<Text style={{ fontSize: 14 }}>🔥</Text>} />
          )}
          <HBChip label={String(totalStars)} leadingIcon={<Text style={{ fontSize: 14 }}>⭐</Text>} />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(80)}>
          <HBCard style={styles.goalCard} depth="sm">
            <Text style={styles.goalLabel}>{isAz ? '🎯 Hədəfin' : '🎯 Твоя цель'}</Text>
            <Text style={styles.adultGoalText}>{adultGoalLabel(goal, isAz)}</Text>
          </HBCard>
        </Animated.View>

        {MODES.map((m, i) => (
          <Animated.View key={m.key} entering={FadeInUp.duration(500).delay(150 + i * 80)}>
            <Pressable
              onPress={() => go(m.key, m.scenario, m.premium)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <HBCard
                style={styles.modeCard}
                depth={i === 0 ? 'deep' : 'sm'}
                ringColor={i === 0 ? m.tint : undefined}
              >
                <View style={[styles.modeEmoji, { backgroundColor: colors.bg }]}>
                  <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modeTitle}>{isAz ? m.az : m.ru}</Text>
                  <Text style={styles.modeSub}>
                    {m.premium && !isPremium
                      ? isAz ? 'Premium' : 'Premium'
                      : isAz ? m.subAz : m.subRu}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>{m.premium && !isPremium ? '👑' : '›'}</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        ))}

        <BottomTabsSpacer />
      </ScrollView>
      <BottomTabs />
    </PaperBackground>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const activeLearningLanguage = useSettings((s) => s.activeLearningLanguage);
  const setActiveLearningLanguage = useSettings((s) => s.setActiveLearningLanguage);
  const currentDay = useSettings((s) => s.currentDay);
  const totalStars = useSettings((s) => s.totalStars);
  const streak = useSettings((s) => s.streak);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);
  const dailyGoal = useSettings((s) => s.dailyGoal);
  const starsEarnedToday = useSettings((s) => s.starsEarnedToday);
  const starsResetDate = useSettings((s) => s.starsResetDate);
  const reset = useSettings((s) => s.reset);
  const bot = useCompanionName();
  const accent = useAccent();

  const isAz = lang === 'az';
  // Active course language (when 2 are picked, the parent can switch which one today's lesson is in)
  const firstLang = activeLearningLanguage ?? learningLanguages[0] ?? 'en';
  const lesson = getLesson(firstLang, currentDay);
  const themes = getLessonThemes(firstLang);

  const isPremium = useSettings((s) => s.isPremium);
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const proactiveOptIn = useSettings((s) => s.proactiveOptIn);
  const profileType = useSettings((s) => s.profileType);
  const childAgeRange = useSettings((s) => s.childAgeRange);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  // Founder's rule: under 10 → playful & colorful; 10-16 → calmer.
  const isPlayful = childAgeRange === '5-7' || childAgeRange === '8-10';
  const isTrialMode = !authToken;

  // Proactive memory threads — Хани's "I remembered something" follow-ups.
  const [dueThread, setDueThread] = useState<MemoryThread | null>(null);

  const today = todayISO();
  const displayedTodayStars = starsResetDate === today ? starsEarnedToday : 0;
  const doneToday = lastCompletedDate === today;
  const isAiDay = currentDay > STATIC_MAX_DAY;
  const needsUpgrade = currentDay > FREE_DAYS && !isPremium;

  // Path is the hero for younger kids ("путь обучения на главный план"); teens
  // (14–16) land on Today, which leans toward conversation CTAs.
  const [activeTab, setActiveTab] = useState<'today' | 'path'>(
    childAgeRange === '14-16' ? 'today' : 'path',
  );
  const [aiLessonReady, setAiLessonReady] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  // Days 1-30 are AI-generated too — track whether THIS day's personalized lesson is
  // cached, so we can show a "preparing" state instead of the bundled fallback.
  const [curriculumReady, setCurriculumReady] = useState(true);
  const [curriculumError, setCurriculumError] = useState(false);
  const [curriculumRetry, setCurriculumRetry] = useState(0);
  const [freezeUsedThisSession, setFreezeUsedThisSession] = useState(false);

  const refillStreakFreezes = useSettings((s) => s.refillStreakFreezes);
  const useStreakFreezeFn = useSettings((s) => s.useStreakFreeze);
  const streakFreezesAvailable = useSettings((s) => s.streakFreezesAvailable);

  useEffect(() => {
    refillStreakFreezes();
    if (streak === 0 || !lastCompletedDate || doneToday) {
      scheduleStreakRiskReminder(childName, streak, doneToday, isAz, bot).catch(() => {});
      return;
    }
    // Local, matching how lastCompletedDate is written — a UTC comparison here
    // burned a streak freeze on evening learners whose chain was actually intact.
    const tz = localOffsetMinutes();
    const yesterday = localYesterdayISO(tz);
    const dayBefore = localDateISO(tz, new Date(Date.now() - 2 * 86400000));
    if (lastCompletedDate !== yesterday && lastCompletedDate <= dayBefore && streakFreezesAvailable > 0) {
      const used = useStreakFreezeFn();
      if (used) setFreezeUsedThisSession(true);
    }
    scheduleStreakRiskReminder(childName, streak, doneToday, isAz, bot).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAiDay || !childId || !authToken) {
      setAiLessonReady(null);
      return;
    }
    const start = weekStartFor(currentDay);
    ensureWeekCached(childId, firstLang, start, authToken)
      .then(({ ready }) => setAiLessonReady(ready > 0))
      .catch(() => setAiLessonReady(false));
  }, [isAiDay, childId, authToken, firstLang, currentDay]);

  // Days 1-30 are now AI-generated too: ensure the current day is fetched/cached so
  // the lesson screens serve the personalized content instead of falling back to the
  // bundled beginner template during the first-generation window.
  useEffect(() => {
    // Guest / offline: keep the bundled fallback, never block.
    if (isAiDay || !childId || !authToken) {
      setCurriculumReady(true);
      return;
    }
    if (getCachedCurriculumLesson(childId, firstLang, currentDay)) {
      setCurriculumReady(true);
      return;
    }
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setCurriculumReady(false);
    setCurriculumError(false);

    // A null result usually means the week is STILL generating (the server
    // regenerates missing weeks on demand) — retry a few times before giving
    // up honestly instead of silently opening the bundled template.
    const tryFetch = () => {
      fetchCurriculumLesson(childId, currentDay, firstLang, authToken)
        .then((l) => {
          if (cancelled) return;
          if (l) {
            setCurriculumReady(true);
            return;
          }
          attempt += 1;
          if (attempt < 3) timer = setTimeout(tryFetch, 5000);
          else setCurriculumError(true);
        })
        .catch(() => {
          if (cancelled) return;
          attempt += 1;
          if (attempt < 3) timer = setTimeout(tryFetch, 5000);
          else setCurriculumError(true);
        });
    };
    tryFetch();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAiDay, childId, authToken, firstLang, currentDay, curriculumRetry]);

  // Load Хани's follow-up threads: surface a due one as the "wants to ask" banner,
  // and (re)schedule local proactive callbacks for upcoming ones (opt-in gated).
  useEffect(() => {
    if (!childId || !authToken) return;
    let cancelled = false;
    getThreads(childId, firstLang, authToken)
      .then((threads) => {
        if (cancelled) return;
        setDueThread(threads.find((t) => t.followUpAt && t.followUpAt <= today) ?? null);
        scheduleFriendCallbacks(
          threads.map((t) => ({ id: t.id, text: t.text, followUpAt: t.followUpAt, language: t.language })),
          { childName, optIn: proactiveOptIn, windowStartHour: 16, isAz },
        ).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [childId, authToken, firstLang, today, proactiveOptIn]);

  const handleGeneratePlan = async () => {
    if (!childId || !authToken || generating) return;
    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const result = await triggerWeekGeneration(childId, firstLang, authToken);
    if (result.ok) {
      const start = weekStartFor(currentDay);
      const { ready } = await ensureWeekCached(childId, firstLang, start, authToken);
      setAiLessonReady(ready > 0);
    }
    setGenerating(false);
  };

  const isQuizDay = currentDay > 7 && currentDay <= 30 && (currentDay - 1) % 7 === 0;
  // Level/age-appropriate flow: kids get the playful mode rotation, teens/B1+
  // get text-first (read → grammar → talk) — no "say the magic word".
  const mature = isMatureLearner(childLevel, childAgeBand);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Unified gate: never start a bundled-template lesson while the child's AI
    // plan for this day is still generating — same rule as the hero card.
    if (
      childId && authToken && currentDay <= STATIC_MAX_DAY &&
      !getCachedCurriculumLesson(childId, firstLang, currentDay)
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      fetchCurriculumLesson(childId, currentDay, firstLang, authToken)
        .then((l) => setCurriculumReady(!!l))
        .catch(() => {});
      Alert.alert(
        '⏳',
        isAz
          ? `${bot} bu dərsi hələ yığır — bir dəqiqə!`
          : `${bot} ещё собирает этот урок — секундочку!`,
      );
      return;
    }
    // The AI day's focus decides the hero activity the path node leads into.
    const focus = getLesson(firstLang, currentDay)?.focus;
    const route =
      focus === 'story_listen'
        ? '/listening'
        : focus === 'conversation'
          ? // Graded conversation day: fromLesson+convo give it a real finish
            // (turn-based wrap-up → completion screen → stars/streak/day+1).
            `/talk?lang=${firstLang}&day=${currentDay}&fromLesson=1&convo=1`
          : lessonEntryRoute(currentDay, firstLang, mature);
    track({ event: 'lesson_started', userId, childId, props: { lang: firstLang, day: currentDay, mode: focus ?? (mature ? 'read' : 'kid-mode') } });
    router.push(route as any);
  };

  const handleStartQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track({ event: 'lesson_started', userId, childId, props: { lang: firstLang, day: currentDay, mode: 'quiz' } });
    router.push(`/lesson/quiz?lang=${firstLang}&endDay=${currentDay - 1}` as any);
  };

  const parentalGate = useParentalGate();
  const isBedtime = useBedtime();

  // Adult learners get a talk-hub home instead of the kid lesson flow.
  if (profileType === 'adult') return <AdultHome />;

  return (
    <PaperBackground variant={isBedtime ? 'night' : isPlayful ? 'honey' : 'cream'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── TOP BAR ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
          <View style={[styles.petAvatar, shadow.sm]}>
            <HBPet size={32} eyes={false} mood={doneToday ? 'sleepy' : 'happy'} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tbGreeting}>
              {isAz ? `Salam, ${childName}!` : `Привет, ${childName}!`}
            </Text>
            <Text style={styles.tbSubtitle}>
              {doneToday
                ? isAz
                  ? 'Hani məmnundur 🍯'
                  : 'Хани доволен 🍯'
                : isAz
                ? 'Hani acdır 🍯'
                : 'Хани голоден 🍯'}
            </Text>
          </View>
          {streak > 0 && (
            <HBChip
              label={String(streak)}
              leadingIcon={<Text style={{ fontSize: 14 }}>{freezeUsedThisSession ? '❄️' : '🔥'}</Text>}
            />
          )}
          <HBChip
            label={String(totalStars)}
            leadingIcon={<Text style={{ fontSize: 14 }}>⭐</Text>}
          />
        </Animated.View>

        {/* ── LANGUAGE SWITCH (only when learning two) ── */}
        {learningLanguages.length > 1 && (
          <Animated.View entering={FadeInDown.duration(450).delay(60)} style={styles.langToggleRow}>
            {learningLanguages.map((l) => {
              const active = l === firstLang;
              return (
                <Pressable
                  key={l}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveLearningLanguage(l);
                  }}
                  style={[styles.langPill, active && styles.langPillActive]}
                >
                  <Text style={{ fontSize: fontSize.sm }}>{l === 'en' ? '🇬🇧' : '🇷🇺'}</Text>
                  <Text style={[styles.langPillText, active && { color: colors.white }]}>
                    {l.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* ── TAB SWITCHER: Bu gün / Yol ── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'today' && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab('today'); }}
          >
            <Text style={[styles.tabBtnText, activeTab === 'today' && styles.tabBtnTextActive]}>
              {isAz ? '📚 Bu gün' : '📚 Сегодня'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === 'path' && styles.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab('path'); }}
          >
            <Text style={[styles.tabBtnText, activeTab === 'path' && styles.tabBtnTextActive]}>
              {isAz ? '🗺️ Yol' : '🗺️ Путь'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* ══ TAB: BU GÜN ══ */}
        {activeTab === 'today' && (<>

        {/* ── ХАНИ WANTS TO ASK (proactive memory thread due today) ── */}
        {dueThread && (
          <Animated.View entering={FadeInDown.duration(450).delay(40)}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push(`/talk?threadId=${dueThread.id}&lang=${dueThread.language}` as any);
              }}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <HBCard style={styles.askCard} depth="md" ringColor={colors.accent}>
                <View style={styles.askIcon}>
                  <HBPet size={34} eyes={false} mood="curious" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.askTitle}>
                    {isAz ? `${bot} soruşmaq istəyir 💬` : `${bot} хочет спросить 💬`}
                  </Text>
                  <Text style={styles.askSub} numberOfLines={1}>
                    {withCompanionName(dueThread.text, bot)}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>›</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        )}

        {/* ── DAILY GOAL ── */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)}>
          <HBCard style={styles.goalCard} depth="sm">
            <View style={styles.goalHeader}>
              <View style={styles.goalLabelRow}>
                <Text style={styles.goalLabel}>
                  {isAz ? '🎯 Bugünkü hədəf' : '🎯 Цель на сегодня'}
                </Text>
                {displayedTodayStars >= dailyGoal && (
                  <View style={styles.goalDoneBadge}>
                    <Text style={styles.goalDoneText}>
                      {isAz ? 'TAMAM!' : 'ЕСТЬ!'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.goalProgress}>
                {Math.min(displayedTodayStars, dailyGoal)} / {dailyGoal} ⭐
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  { width: `${Math.min(100, (displayedTodayStars / dailyGoal) * 100)}%`, backgroundColor: accent.bottom },
                  displayedTodayStars >= dailyGoal && { backgroundColor: colors.success },
                ]}
              />
            </View>
            {!isAiDay && (
              <Text style={styles.courseLabel}>
                {isAz ? `Kurs: ${currentDay} / 30 gün` : `Курс: ${currentDay} / 30 дней`}
              </Text>
            )}
          </HBCard>
        </Animated.View>

        {/* ── MAIN STATE ── */}
        {isTrialMode && currentDay > 1 ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.heroCard} depth="deep" ringColor={colors.butter}>
              <Text style={{ fontSize: 52, textAlign: 'center' }}>💾</Text>
              <Text style={styles.heroTitle}>
                {isAz ? 'Tərəqqini saxla!' : 'Сохрани прогресс!'}
              </Text>
              <Text style={styles.heroSub}>
                {isAz
                  ? `Birinci günü əla bitirdin! Növbəti günlərə davam etmək üçün hesab yarat — pulsuzdur.`
                  : `Отлично прошёл первый день! Чтобы продолжить дальше — создай аккаунт. Бесплатно.`}
              </Text>
              <HBButton
                full
                variant="primary"
                label={isAz ? '✨ Hesab yarat' : '✨ Создать аккаунт'}
                onPress={() => router.push('/auth/consent' as any)}
              />
            </HBCard>
          </Animated.View>
        ) : !isAiDay && !curriculumReady && !needsUpgrade ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.heroCard} depth="deep" ringColor={curriculumError ? colors.berry : colors.accent}>
              {curriculumError ? (
                <>
                  <Text style={{ fontSize: 52, textAlign: 'center' }}>😕</Text>
                  <Text style={styles.heroTitle}>
                    {isAz ? 'Dərsi yükləmək alınmadı' : 'Не получилось загрузить урок'}
                  </Text>
                  <Text style={styles.heroSub}>
                    {isAz ? 'İnterneti yoxla və yenidən cəhd et.' : 'Проверь интернет и попробуй ещё раз.'}
                  </Text>
                  <HBButton
                    full
                    variant="primary"
                    label={isAz ? 'Yenidən cəhd et' : 'Повторить'}
                    onPress={() => { setCurriculumError(false); setCurriculumRetry((r) => r + 1); }}
                  />
                  <HBButton
                    full
                    variant="ghost"
                    label={isAz ? 'Oflayn davam et' : 'Продолжить офлайн'}
                    onPress={() => { setCurriculumError(false); setCurriculumReady(true); }}
                  />
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 52, textAlign: 'center' }}>🛠️✨</Text>
                  <Text style={styles.heroTitle}>
                    {isAz ? 'Dərslər hazırlanır...' : 'Готовлю уроки...'}
                  </Text>
                  <Text style={styles.heroSub}>
                    {isAz
                      ? `${bot} ${childName} üçün fərdi dərsləri qurur — bir neçə saniyə.`
                      : `${bot} собирает персональные уроки для ${childName} — пара секунд.`}
                  </Text>
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[3] }} />
                </>
              )}
            </HBCard>
          </Animated.View>
        ) : isAiDay && !lesson && !needsUpgrade ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.heroCard} depth="deep" ringColor={colors.accent}>
              <Text style={{ fontSize: 52, textAlign: 'center' }}>🤖✨</Text>
              <Text style={styles.heroTitle}>
                {isAz ? 'AI hazırlayır...' : 'AI готовит план...'}
              </Text>
              <Text style={styles.heroSub}>
                {isAz
                  ? `Söz ${bot} ${childName} üçün fərdi həftəlik plan qurur. Bu bir neçə saniyə çəkir.`
                  : `Söz ${bot} составляет персональный план для ${childName} на эту неделю. Это займёт несколько секунд.`}
              </Text>
              {generating || aiLessonReady === null ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[3] }} />
              ) : (
                <HBButton
                  full
                  variant="accent"
                  label={isAz ? '✨ Planı yarat' : '✨ Создать план'}
                  onPress={handleGeneratePlan}
                />
              )}
            </HBCard>
          </Animated.View>
        ) : needsUpgrade ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.heroCard} depth="deep" ringColor={colors.butter}>
              <Text style={{ fontSize: 52, textAlign: 'center' }}>👑</Text>
              <Text style={styles.heroTitle}>
                {isAz ? 'Premium lazımdır' : 'Нужен Premium'}
              </Text>
              <Text style={styles.heroSub}>
                {isAz
                  ? `Sən ${FREE_DAYS} pulsuz günü bitirdin! Bütün 30 günü açmaq üçün Söz Premium al.`
                  : `Ты прошёл ${FREE_DAYS} бесплатных дней! Открой все 30 дней с Söz Premium.`}
              </Text>
              <HBButton
                full
                variant="butter"
                label={isAz ? '🚀 Premium almaq' : '🚀 Получить Premium'}
                onPress={() => parentalGate.run(() => router.push('/paywall' as any))}
              />
            </HBCard>
          </Animated.View>
        ) : doneToday ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)} style={{ gap: spacing[3] }}>
            <HBCard style={styles.doneCard} depth="deep">
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={styles.doneTitle}>
                {isAz ? 'Bugünkü dərs tamamlandı!' : 'Урок сегодня выполнен!'}
              </Text>
              <Text style={styles.doneSub}>
                {isAz ? 'Daha nə edə bilərsən?' : 'Что ещё можно сделать?'}
              </Text>
              <View style={styles.doneStars}>
                <Text style={{ fontSize: fontSize.lg }}>⭐</Text>
                <Text style={styles.doneStarsText}>
                  {isAz ? `${totalStars} ulduz cəm` : `${totalStars} звёзд всего`}
                </Text>
              </View>
            </HBCard>

            <Pressable
              onPress={() => router.push(`/talk?lang=${firstLang}&day=${currentDay}` as any)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <HBCard style={styles.ctaCard} depth="sm">
                <View style={[styles.ctaIcon, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ fontSize: 22 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>
                    {isAz ? `${bot} ilə danış` : `Поговори с ${bot}`}
                  </Text>
                  <Text style={styles.ctaSub}>
                    {isAz ? 'Sərbəst söhbət' : 'Свободный разговор'}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>›</Text>
              </HBCard>
            </Pressable>

            <Pressable
              onPress={() => router.push('/memory' as any)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <HBCard style={styles.ctaCard} depth="sm">
                <View style={[styles.ctaIcon, { backgroundColor: '#FFF6D0' }]}>
                  <Text style={{ fontSize: 22 }}>🧠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>
                    {isAz ? `${bot} nəyi xatırlayır` : `Что ${bot} помнит о тебе`}
                  </Text>
                  <Text style={styles.ctaSub}>
                    {isAz ? 'Sənə dair faktlar' : 'Факты о тебе'}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>›</Text>
              </HBCard>
            </Pressable>

            <Pressable
              onPress={() => router.push('/pet-room' as any)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <HBCard style={styles.ctaCard} depth="sm">
                <View style={[styles.ctaIcon, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ fontSize: 22 }}>🏠</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>
                    {isAz ? 'Hani-nin otağı' : 'Комната Хани'}
                  </Text>
                  <Text style={styles.ctaSub}>
                    {isAz ? 'Yedir, oyna, qayğı göstər' : 'Корми, играй, ухаживай'}
                  </Text>
                </View>
                <Text style={styles.ctaArrow}>›</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        ) : isQuizDay ? (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.heroCard} depth="deep" ringColor={colors.butter}>
              <Text style={{ fontSize: 56, textAlign: 'center' }}>🔥</Text>
              <Text style={styles.heroTitle}>
                {isAz ? 'Həftəlik test' : 'Недельный тест'}
              </Text>
              <Text style={styles.heroSub}>
                {isAz
                  ? '7 sual · keçən həftənin sözləri'
                  : '7 вопросов · слова прошедшей недели'}
              </Text>
              <HBButton
                full
                variant="butter"
                label={isAz ? 'Testi başlat 🚀' : 'Начать тест 🚀'}
                onPress={handleStartQuiz}
              />
            </HBCard>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(600).delay(150)}>
            <HBCard style={styles.lessonCard} depth="deep">
              {/* chapter ornament */}
              <View style={styles.chapterHeader}>
                <View style={styles.chapterRule} />
                <Text style={styles.chapterLabel}>
                  {isAz ? `FƏSİL ${currentDay}` : `ГЛАВА ${currentDay}`}
                </Text>
                <View style={styles.chapterRule} />
              </View>

              <View style={styles.lessonHeroRow}>
                <View style={styles.themeEmojiCircle}>
                  <Text style={styles.themeEmoji}>{lesson?.themeEmoji ?? '📖'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.themeMeta}>
                    {isAz ? `Dərs ${currentDay}` : `Урок ${currentDay}`}
                  </Text>
                  <Text style={styles.themeTitle}>
                    {lesson?.theme ?? (firstLang === 'en' ? 'Lesson' : 'Урок')}
                  </Text>
                  <Text style={styles.themeMetaSub}>
                    {isAz ? '5 yeni söz · ~15 dəq' : '5 новых слов · ~15 мин'}
                  </Text>
                </View>
                <View style={styles.flagsRow}>
                  {learningLanguages.map((l) => (
                    <Text key={l} style={{ fontSize: fontSize.lg }}>{l === 'en' ? '🇬🇧' : '🇷🇺'}</Text>
                  ))}
                </View>
              </View>

              {lesson && (
                <View style={styles.vocabRow}>
                  {lesson.vocabulary.slice(0, 4).map((word) => (
                    <View key={word} style={styles.vocabChip}>
                      <Text style={styles.vocabWord}>{word}</Text>
                    </View>
                  ))}
                  {lesson.vocabulary.length > 4 && (
                    <View style={styles.vocabChip}>
                      <Text style={styles.vocabWord}>+{lesson.vocabulary.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Хани encouragement bubble */}
              <View style={styles.encourage}>
                <HBPet size={isPlayful ? 58 : 48} />
                <View style={[styles.speechBubble, shadow.sm]}>
                  <Text style={styles.speechText}>
                    {isAz ? 'Birlikdə öyrənək!' : 'Учим вместе!'}
                  </Text>
                  <View style={styles.speechTail} />
                </View>
              </View>

              <HBButton
                full
                variant="primary"
                label={isAz ? 'Dərsi başlat 🚀' : 'Начать урок 🚀'}
                onPress={handleStart}
              />
            </HBCard>
          </Animated.View>
        )}

        {/* ── DAY PLAN LINK ── */}
        <Animated.View entering={FadeInUp.duration(400).delay(220)} style={{ marginTop: spacing[2] }}>
          <Pressable
            onPress={() => router.push('/day-plan' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <HBCard style={styles.planLink} depth="sm">
              <Text style={{ fontSize: 20 }}>📋</Text>
              <Text style={styles.planLinkText}>
                {isAz ? 'Bu günün planı' : 'План на сегодня'}
              </Text>
              <Text style={styles.planLinkArrow}>›</Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── TALK ON A TOPIC ── */}
        <Animated.View entering={FadeInUp.duration(400).delay(240)} style={{ marginTop: spacing[2] }}>
          <Pressable
            onPress={() => router.push('/topics' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <HBCard style={styles.planLink} depth="sm" ringColor={colors.accent}>
              <Text style={{ fontSize: 20 }}>🗣️</Text>
              <Text style={styles.planLinkText}>
                {isAz ? 'Mövzuda danış' : 'Поговорить на тему'}
              </Text>
              <Text style={styles.planLinkArrow}>›</Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── LISTENING STORY ── */}
        <Animated.View entering={FadeInUp.duration(400).delay(250)} style={{ marginTop: spacing[2] }}>
          <Pressable
            onPress={() => router.push('/listening' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <HBCard style={styles.planLink} depth="sm" ringColor={colors.butter}>
              <Text style={{ fontSize: 20 }}>🎧</Text>
              <Text style={styles.planLinkText}>
                {isAz ? 'Hekayə dinlə' : 'Послушать историю'}
              </Text>
              <Text style={styles.planLinkArrow}>›</Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── QUICK LINKS (Streak + Album) ── */}
        <Animated.View entering={FadeInUp.duration(400).delay(260)} style={[styles.quickLinks, { marginBottom: spacing[2] }]}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push('/streak' as any)}
          >
            <HBCard style={styles.quickCard} depth="sm">
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={styles.quickCardText}>
                {isAz ? 'Seriya' : 'Серия'}
              </Text>
            </HBCard>
          </Pressable>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => router.push('/album' as any)}
          >
            <HBCard style={styles.quickCard} depth="sm">
              <Text style={{ fontSize: 18 }}>📖</Text>
              <Text style={styles.quickCardText}>
                {isAz ? 'Sözlər' : 'Слова'}
              </Text>
            </HBCard>
          </Pressable>
        </Animated.View>

        {/* ── BEDTIME CTA ── */}
        {isBedtime && (
          <Animated.View entering={FadeInUp.duration(400).delay(280)}>
            <Pressable
              onPress={() => router.push(`/read?lang=${firstLang}&day=${currentDay}` as any)}
            >
              <HBCard depth="md" ringColor="#6B54E0" style={styles.bedtimeCard}>
                <View style={[styles.bedtimeIcon, { backgroundColor: '#EAE6FF' }]}>
                  <Text style={{ fontSize: 26 }}>🌙</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bedtimeTitle}>
                    {isAz ? 'Yataqdan əvvəl hekayə' : 'Сказка перед сном'}
                  </Text>
                  <Text style={styles.bedtimeSub}>
                    {isAz ? 'Hani ilə sakit oxu' : 'Тихое чтение с Хани'}
                  </Text>
                </View>
                <Text style={{ fontSize: fontSize['2xl'], color: '#6B54E0', fontFamily: fontFamily.bodyBlack }}>›</Text>
              </HBCard>
            </Pressable>
          </Animated.View>
        )}

        {/* ── hint to open path tab ── */}
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab('path'); }}
          style={styles.pathHintRow}
        >
          <Text style={styles.pathHintText}>
            {isAz ? '🗺️ Kurs xəritəsinə bax →' : '🗺️ Посмотреть карту курса →'}
          </Text>
        </Pressable>

        </>)}
        {/* ══ END TAB: BU GÜN ══ */}

        {/* ══ TAB: YOL (PATH) ══ */}
        {activeTab === 'path' && themes.length > 1 && (
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={styles.journeySection}>
            <Text style={styles.journeyTitle}>
              {isAz ? '🗺️ Sənin yolun · 30 gün' : '🗺️ Твой путь · 30 дней'}
            </Text>

            {WORLDS.map((world, worldIdx) => {
              const worldThemes = themes
                .filter((t) => t.day >= world.startDay && t.day <= world.endDay)
                .sort((a, b) => a.day - b.day);
              if (worldThemes.length === 0) return null;
              const worldDone = world.endDay < currentDay;
              const worldCurrent = currentDay >= world.startDay && currentDay <= world.endDay;
              const worldLockedByOrder = currentDay < world.startDay;
              // AI plan present → neutral chapter title + the plan's own emoji;
              // the static world names no longer describe the child's real themes.
              const aiWeek = worldThemes.find((t) => t.ai);
              const worldTitle = aiWeek
                ? (isAz ? `Fəsil ${worldIdx + 1}` : `Глава ${worldIdx + 1}`)
                : worldLabel(world, isAz ? 'az' : 'ru');
              const worldEmoji = aiWeek?.emoji ?? world.emoji;

              return (
                <View key={world.id} style={[styles.worldBlock, { borderLeftColor: worldLockedByOrder ? colors.bgDeep : world.color }]}>
                  {/* World header */}
                  <View style={[styles.worldHeader, { backgroundColor: world.tint }]}>
                    <View style={[styles.worldBadge, { backgroundColor: world.color }]}>
                      <Text style={styles.worldBadgeEmoji}>{worldEmoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.worldName, { color: worldLockedByOrder ? colors.inkSoft : world.color }]}>
                        {worldTitle}
                      </Text>
                      <Text style={styles.worldSub}>
                        {isAz
                          ? `Gün ${world.startDay}–${world.endDay}`
                          : `Дни ${world.startDay}–${world.endDay}`}
                      </Text>
                    </View>
                    {worldDone && <Text style={[styles.worldStatus, { color: colors.accent }]}>✅</Text>}
                    {worldCurrent && <Text style={[styles.worldStatus, { color: world.color }]}>▶</Text>}
                    {worldLockedByOrder && <Text style={[styles.worldStatus, { color: colors.inkSoft, opacity: 0.4 }]}>🔒</Text>}
                  </View>

                  {/* Zigzag path */}
                  <View style={styles.zigzagTrack}>
                    {worldThemes.map((t, idx) => {
                      const isDone = t.day < currentDay || (t.day === currentDay && doneToday);
                      const isCurrent = t.day === currentDay && !doneToday && (t.day <= FREE_DAYS || isPremium);
                      const isPremiumLocked = t.day > FREE_DAYS && !isPremium && !isDone;
                      const lockedByOrder = !isDone && !isCurrent && !isPremiumLocked;
                      const position = ZIGZAG_POS[idx % ZIGZAG_POS.length]!;
                      return (
                        <ZigzagNode
                          key={t.day}
                          day={t.day}
                          isDone={isDone}
                          isCurrent={isCurrent}
                          isPremiumLocked={isPremiumLocked}
                          isLockedByOrder={lockedByOrder}
                          worldColor={world.color}
                          worldTint={world.tint}
                          position={position}
                          isAz={isAz}
                          isLast={idx === worldThemes.length - 1}
                          onPress={isCurrent ? (isQuizDay ? handleStartQuiz : handleStart) : undefined}
                          startLabel={isAz ? 'Başla' : 'Старт'}
                          themeEmoji={t.ai ? t.emoji : undefined}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {__DEV__ && (
          <Pressable
            onPress={() => { reset(); router.replace('/language'); }}
            style={styles.devReset}
          >
            <Text style={{ fontSize: 11, color: colors.inkSoft }}>⚙ reset onboarding</Text>
          </Pressable>
        )}
        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
      <ParentalGateModal {...parentalGate.modalProps} />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[12],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  petAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tbGreeting: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  tbSubtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginTop: 1,
  },

  // language switch
  langToggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  langPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langPillText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },

  // "Хани wants to ask" banner
  askCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[3],
  },
  askIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  askSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // daily goal
  goalCard: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  goalLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  goalDoneBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  goalDoneText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: scaleFont(9),
    letterSpacing: 0.8,
  },
  goalProgress: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  goalTrack: {
    height: 10,
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 10,
  },
  courseLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // adult talk-hub
  adultGoalText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  modeEmoji: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  modeSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // hero / state cards
  heroCard: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[3],
  },

  // done today
  doneCard: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  doneEmoji: { fontSize: 48 },
  doneTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  doneSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  doneStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    backgroundColor: '#FFF6D0',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  doneStarsText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.butterDeep,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  ctaSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  ctaArrow: {
    fontSize: scaleFont(22),
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyBold,
  },

  // active lesson card
  lessonCard: {
    paddingVertical: spacing[5],
    gap: spacing[3],
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  chapterRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.bgDeep,
  },
  chapterLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 2.5,
  },
  lessonHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  themeEmojiCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeEmoji: { fontSize: 36 },
  themeMeta: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  themeTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  themeMetaSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
    marginTop: 2,
  },
  flagsRow: { flexDirection: 'row', gap: spacing[1] },

  vocabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  vocabChip: {
    backgroundColor: colors.bgDeep,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  vocabWord: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  encourage: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  speechBubble: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: 6,
  },
  speechText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  speechTail: {
    position: 'absolute',
    bottom: 6,
    left: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.bg,
  },

  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  planLinkText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    flex: 1,
  },
  planLinkArrow: {
    fontSize: fontSize.xl,
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyBold,
  },

  // quick links row
  quickLinks: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  quickCardText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  // tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: spacing[4],
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  tabBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
  tabBtnTextActive: {
    fontFamily: fontFamily.bodyBlack,
    color: colors.primary,
  },

  // hint row at bottom of today tab
  pathHintRow: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  pathHintText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  // journey strip
  journeySection: {
    gap: spacing[4],
  },
  journeyTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing[1],
  },

  // Bedtime CTA
  bedtimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  bedtimeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedtimeTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  bedtimeSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // World blocks — zigzag path style
  worldBlock: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderLeftWidth: 3,
    marginBottom: spacing[4],
    ...shadow.sm,
  },
  worldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  worldBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  worldBadgeEmoji: { fontSize: 22 },
  worldName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    letterSpacing: -0.3,
  },
  worldSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 1,
  },
  worldStatus: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: scaleFont(22),
  },
  zigzagTrack: {
    backgroundColor: colors.card,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },

  devReset: {
    marginTop: spacing[6],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
});

// Styles for ZigzagNode (kept separate to avoid collision)
const pathStyles = StyleSheet.create({
  nodeRow: {
    alignItems: 'stretch',
  },
  trackSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  node: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDeep,
    ...shadow.sm,
  },
  nodeEmoji: {
    fontSize: fontSize.lg,
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyBlack,
  },
  nodeLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  connector: {
    width: 2,
    height: 16,
    backgroundColor: colors.bgDeep,
    alignSelf: 'center',
    borderRadius: 1,
    marginVertical: 2,
  },
});
