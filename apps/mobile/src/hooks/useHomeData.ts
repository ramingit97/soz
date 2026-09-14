/**
 * Данные главного экрана: урок дня, его готовность, «персонаж хочет спросить»,
 * заморозка серии. Вынесено из `app/home.tsx` без изменения логики — экран
 * отвечает только за вид.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { getLesson, STATIC_MAX_DAY } from '@/data/lessons';
import { getThreads, type MemoryThread } from '@/services/api';
import { fetchCurriculumLesson, getCachedCurriculumLesson } from '@/services/curriculum';
import { ensureWeekCached, triggerWeekGeneration, weekStartFor } from '@/services/generatedLessons';
import { scheduleFriendCallbacks, scheduleStreakRiskReminder } from '@/services/notifications';
import { FREE_DAYS } from '@/services/subscriptions';
import { todayISO, useSettings } from '@/store/settings';
import { useCompanionName } from '@/utils/companion';
import { isMatureLearner } from '@/utils/lessonFlow';
import { localDateISO, localOffsetMinutes, localYesterdayISO } from '@soz/shared-types';

export function useHomeData() {
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const childName = useSettings((s) => s.childName) ?? '';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const activeLearningLanguage = useSettings((s) => s.activeLearningLanguage);
  const currentDay = useSettings((s) => s.currentDay);
  const streak = useSettings((s) => s.streak);
  const lastCompletedDate = useSettings((s) => s.lastCompletedDate);
  const isPremium = useSettings((s) => s.isPremium);
  const childId = useSettings((s) => s.childId);
  const authToken = useSettings((s) => s.authToken);
  const isGuestAccount = useSettings((s) => s.isGuestAccount);
  const proactiveOptIn = useSettings((s) => s.proactiveOptIn);
  const childLevel = useSettings((s) => s.childLevel);
  const childAgeBand = useSettings((s) => s.childAgeBand);
  const refillStreakFreezes = useSettings((s) => s.refillStreakFreezes);
  const useStreakFreezeFn = useSettings((s) => s.useStreakFreeze);
  const streakFreezesAvailable = useSettings((s) => s.streakFreezesAvailable);
  const bot = useCompanionName();

  // Язык курса сегодня (при двух языках родитель переключает, какой идёт сейчас).
  const firstLang = activeLearningLanguage ?? learningLanguages[0] ?? 'en';
  const lesson = getLesson(firstLang, currentDay);
  const today = todayISO();
  const doneToday = lastCompletedDate === today;
  const isAiDay = currentDay > STATIC_MAX_DAY;
  const needsUpgrade = currentDay > FREE_DAYS && !isPremium;
  const isQuizDay = currentDay > 7 && currentDay <= 30 && (currentDay - 1) % 7 === 0;
  // Пробный режим — гостевой аккаунт (у него настоящий токен) или вовсе без
  // токена (старые установки). Проверка одного токена пропускала всех гостей.
  const isTrialMode = !authToken || isGuestAccount;
  // Kids get the playful mode rotation, teens/B1+ get text-first (read → grammar → talk).
  const mature = isMatureLearner(childLevel, childAgeBand);

  const [dueThread, setDueThread] = useState<MemoryThread | null>(null);
  const [aiLessonReady, setAiLessonReady] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  // Days 1-30 are AI-generated too — track whether THIS day's personalized lesson is
  // cached, so we can show a "preparing" state instead of the bundled fallback.
  const [curriculumReady, setCurriculumReady] = useState(true);
  const [curriculumError, setCurriculumError] = useState(false);
  const [curriculumRetry, setCurriculumRetry] = useState(0);
  const [freezeUsedThisSession, setFreezeUsedThisSession] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Load the companion's follow-up threads: surface a due one as the "wants to ask"
  // card, and (re)schedule local proactive callbacks for upcoming ones (opt-in gated).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, authToken, firstLang, today, proactiveOptIn]);

  const generatePlan = async () => {
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

  /** Урок ещё не скачан — перезапросить; true, если уже есть. */
  const ensureTodayLesson = (): boolean => {
    if (childId && authToken && currentDay <= STATIC_MAX_DAY && !getCachedCurriculumLesson(childId, firstLang, currentDay)) {
      fetchCurriculumLesson(childId, currentDay, firstLang, authToken)
        .then((l) => setCurriculumReady(!!l))
        .catch(() => {});
      return false;
    }
    return true;
  };

  return {
    firstLang,
    lesson,
    currentDay,
    doneToday,
    isAiDay,
    needsUpgrade,
    isQuizDay,
    isTrialMode,
    mature,
    dueThread,
    aiLessonReady,
    generating,
    generatePlan,
    curriculumReady,
    curriculumError,
    retryCurriculum: () => {
      setCurriculumError(false);
      setCurriculumRetry((r) => r + 1);
    },
    continueOffline: () => {
      setCurriculumError(false);
      setCurriculumReady(true);
    },
    ensureTodayLesson,
    freezeUsedThisSession,
  };
}
