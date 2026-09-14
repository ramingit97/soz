import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useSettings, type ScheduleDay } from '@/store/settings';
import { companionNameFor } from '@/utils/companion';

/** The child-chosen companion name, or the brand default. Read from the store so
 * scheduled notifications speak of "Бобо" (or whatever the child named the pet),
 * never a stale hardcoded "Bobo". */
function companion(isAz: boolean): string {
  return companionNameFor(useSettings.getState().petName, isAz ? 'az' : 'ru');
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAY_TO_WEEKDAY: Record<ScheduleDay, number> = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleLessonReminders(
  childName: string,
  hour: number,
  days: ScheduleDay[],
  isAz: boolean,
): Promise<void> {
  // Cancel previous reminders first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const bot = companion(isAz);
  const title = isAz ? 'Söz — Dərs vaxtıdır! 📚' : 'Söz — Время учиться! 📚';
  const body = isAz
    ? `Salam, ${childName}! ${bot} səni dərsdə gözləyir 🍯`
    : `Привет, ${childName}! ${bot} ждёт тебя на урок 🍯`;

  // On iOS/Android schedule one notification per selected day of week
  for (const day of days) {
    const weekday = DAY_TO_WEEKDAY[day];
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute: 0,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** One-time local notification — fires immediately to alert the parent that
 * a new AI-generated week is ready to review. Used after weekly generation. */
export async function notifyWeekReady(childName: string, isAz: boolean): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const title = isAz ? '✨ Yeni AI plan hazırdır' : '✨ Новый AI-план готов';
  const body = isAz
    ? `${childName} üçün növbəti həftə üçün şəxsi plan tərtib olundu. Aç və bax.`
    : `Для ${childName} составлен персональный план на следующую неделю. Открой и посмотри.`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { route: '/parent-summary' } },
    trigger: null, // immediate
  });
}

const STREAK_RISK_TAG = 'streak-risk';
const PARENT_DIGEST_TAG = 'parent-digest';
const FRIEND_CALLBACK_TAG = 'friend-callback';
const SENSITIVE_ALERT_TAG = 'sensitive-alert';

/**
 * Immediate, neutral parent alert when something distressing surfaced in a chat.
 * NO details (privacy + safety) — just nudges the parent to open the report and
 * talk with the child. Routes to /parent-summary on tap.
 */
export async function notifyParentSensitive(isAz: boolean): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const title = isAz ? '💛 Bobo bir şey hiss etdi' : '💛 Бобо кое-что заметил';
  const body = isAz
    ? 'Söhbətdə həssas an oldu. Hesabata baxın və uşaqla mehribanca danışın.'
    : 'В разговоре был деликатный момент. Загляните в отчёт и мягко поговорите с ребёнком.';

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { tag: SENSITIVE_ALERT_TAG, route: '/parent-summary' } },
    trigger: null, // immediate
  });
}

interface CallbackThread {
  id: string;
  text: string;
  followUpAt: string | null;
  language: string; // 'en' | 'ru'
}

/**
 * Schedule local "Bobo wants to ask you something" callbacks from memory threads.
 *
 * This is the Phase-1 (no-server) path for proactive follow-ups: when the child
 * mentions an event ("going out with friends tomorrow"), a thread is created with
 * a followUpAt date, and this schedules a gentle local push for that day.
 *
 * Guardrails: parent opt-in (default off), at most one push per day, fires only
 * in the daytime window, warm curiosity only (no guilt). Past-due threads are
 * surfaced by the home banner instead of a push. Idempotent — cancels and
 * re-schedules all friend callbacks on each call.
 */
export async function scheduleFriendCallbacks(
  threads: CallbackThread[],
  opts: { childName: string; optIn: boolean; windowStartHour?: number; isAz: boolean },
): Promise<void> {
  // Clear previous friend callbacks first (idempotent re-sync)
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.tag === FRIEND_CALLBACK_TAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (!opts.optIn) return; // proactive is opt-in — default off, especially for kids

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const hour = opts.windowStartHour ?? 16;
  const now = Date.now();
  const scheduledDays = new Set<string>(); // ≤1 callback per calendar day

  for (const t of threads) {
    if (!t.followUpAt || scheduledDays.has(t.followUpAt)) continue;
    const date = new Date(`${t.followUpAt}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(hour, 0, 0, 0);
    if (date.getTime() <= now) continue; // due in the past → home banner handles it, no push

    scheduledDays.add(t.followUpAt);
    const snippet = t.text.length > 60 ? `${t.text.slice(0, 57)}…` : t.text;
    const title = opts.isAz ? 'Bobo soruşmaq istəyir 🐻' : 'Бобо хочет спросить 🐻';
    const body =
      t.language === 'en'
        ? `Hi ${opts.childName}! You mentioned "${snippet}" — how did it go? Let's chat 🐻`
        : `Привет, ${opts.childName}! Ты говорил про "${snippet}" — как всё прошло? Давай поболтаем 🐻`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { tag: FRIEND_CALLBACK_TAG, route: '/talk', threadId: t.id, language: t.language },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

/**
 * Schedule a gentle evening nudge for tonight at 8 PM if the child has an active
 * streak and hasn't practised today. Auto-cancels and re-schedules on each call
 * (idempotent).
 *
 * Deliberately warm, NOT loss-aversion: no "your streak is in danger", no
 * "hurry before midnight". The market analysis flagged streak-anxiety / guilt
 * pushes as a documented harm to kids (the "crying Duo" anti-pattern). Since a
 * missed day is auto-covered by a streak freeze anyway, we reassure instead of
 * threaten — the companion misses them, and the streak is safe either way.
 */
export async function scheduleStreakRiskReminder(
  childName: string,
  streak: number,
  doneToday: boolean,
  isAz: boolean,
  companionName?: string,
): Promise<void> {
  // Cancel any previous streak-risk notif first
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.tag === STREAK_RISK_TAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (doneToday || streak < 2) return; // Nothing to remind

  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Schedule for 8 PM today (or tomorrow if it's already past 8 PM)
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target.getTime() <= now.getTime()) return; // Too late today

  const bot = companionName || (isAz ? 'Bobo' : 'Бобо');
  const title = isAz ? `🍯 ${bot} səni xatırlayır` : `🍯 ${bot} соскучился`;
  const body = isAz
    ? `${childName}, bir neçə dəqiqə birlikdə? Buraxsan da narahat olma — ${bot} seriyanı saxlayacaq 💛`
    : `${childName}, пара минут вместе? А пропустишь — не страшно, ${bot} сбережёт вашу серию 💛`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { tag: STREAK_RISK_TAG, route: '/home' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

/**
 * Schedule a daily evening digest for the parent — fires once at 21:00 if
 * the child completed a lesson today. Routes to /parent-summary on tap.
 *
 * Idempotent: cancels previous digest for this date before re-scheduling.
 */
export async function scheduleParentEveningDigest(
  childName: string,
  starsToday: number,
  wordsLearnedToday: number,
  isAz: boolean,
): Promise<void> {
  // Cancel any previous digest notif first
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.tag === PARENT_DIGEST_TAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (starsToday === 0) return; // Nothing to report

  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Schedule for 21:00 today (or skip if already past)
  const now = new Date();
  const target = new Date();
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) return;

  const title = isAz
    ? `📊 ${childName}-nin bu günkü tərəqqi`
    : `📊 Сегодняшний прогресс ${childName}`;
  const body = isAz
    ? `${starsToday} ulduz qazandı · ${wordsLearnedToday} yeni söz öyrəndi. Hesabatı aç →`
    : `Заработал ${starsToday} ⭐ · выучил ${wordsLearnedToday} ${wordsLearnedToday === 1 ? 'слово' : 'слов'}. Открыть отчёт →`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { tag: PARENT_DIGEST_TAG, route: '/parent-summary' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}
