import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LanguageCode, ParentUILanguage } from '@soz/shared-types';
import { localDateISO, localOffsetMinutes, localYesterdayISO, nextStreak } from '@soz/shared-types';

// CEFR-native levels — mobile now speaks the SAME vocabulary as the API/DB
// (beginner/elementary/pre_intermediate/intermediate ≈ A1/A2/B1/B2), so the
// old zero/some/school → beginner/elementary LEVEL_MAP indirection is gone.
export type ChildLevel = 'beginner' | 'elementary' | 'pre_intermediate' | 'intermediate';
export type AgeBand = 'young' | 'mid' | 'teen' | 'adult';
export type ProfileType = 'kid' | 'adult';
export type ScheduleDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ScheduleMinutes = 10 | 15 | 20 | 30 | 45 | 60;

/** What the learner wants to improve most — shapes home emphasis + lesson skin. */
export type LearningFocus = 'speaking' | 'listening' | 'words' | 'grammar';

/**
 * Age range chosen at onboarding (AZ school-aligned: 1st grade at 6, primary
 * 1–4, then middle/high to ~10th grade). Drives BOTH:
 *   • visual register — `playful` (colorful, mascot-forward) under ~10, calmer above;
 *   • engine — younger = gamified play; `conversation` (speaking/listening-first) for 14–16.
 */
export type AgeRange = '5-7' | '8-10' | '11-13' | '14-16' | 'adult';
export const AGE_RANGE_META: Record<
  AgeRange,
  { repAge: number; band: AgeBand; playful: boolean; conversation: boolean }
> = {
  '5-7': { repAge: 6, band: 'young', playful: true, conversation: false },
  '8-10': { repAge: 9, band: 'mid', playful: true, conversation: false },
  '11-13': { repAge: 12, band: 'mid', playful: false, conversation: false },
  '14-16': { repAge: 15, band: 'teen', playful: false, conversation: true },
  adult: { repAge: 25, band: 'adult', playful: false, conversation: true },
};

/**
 * Map the learner's chosen focus onto the lesson "dials" the generator understands.
 *
 * «Слушать» раньше тоже превращалось в `moreTalk` — сервер не знал другого. Теперь
 * это отдельный `moreListening`: план с упором на истории на слух.
 *
 * ПОРЯДОК ВЫКЛАДКИ: сначала API, потом приложение. Схема `lessonPrefs` на сервере
 * строгая (`.strict()`), и API без `moreListening` отвечает 400 на создание
 * ребёнка — онбординг с упором «Слушать» падал бы на последнем шаге.
 */
export function focusToLessonPrefs(
  focus: LearningFocus[],
): { moreTalk?: boolean; moreWords?: boolean; moreListening?: boolean } {
  const prefs: { moreTalk?: boolean; moreWords?: boolean; moreListening?: boolean } = {};
  if (focus.includes('speaking')) prefs.moreTalk = true;
  if (focus.includes('listening')) prefs.moreListening = true;
  if (focus.includes('words')) prefs.moreWords = true;
  return prefs;
}

const VALID_LEVELS: ChildLevel[] = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'];

/** Coerce any server/legacy level string into a valid CEFR-native ChildLevel. */
function normalizeLevel(raw: string | null | undefined): ChildLevel {
  if (raw && (VALID_LEVELS as string[]).includes(raw)) return raw as ChildLevel;
  // legacy onboarding codes, in case an old row still carries them
  if (raw === 'some') return 'elementary';
  if (raw === 'school') return 'pre_intermediate';
  return 'beginner';
}

export interface LessonError {
  kind: 'word_game' | 'grammar' | 'pronunciation';
  prompt: string;
  correct: string;
  given: string;
}

/**
 * Today's calendar date for this device, `yyyy-mm-dd`.
 *
 * LOCAL, not UTC. Eleven call sites compare it against `lastCompletedDate`, which
 * the server now writes in the learner's local day — a UTC value here would
 * disagree with it every evening after 20:00 in Baku (UTC+4) and tell a child who
 * had just finished a lesson that they still owed one today.
 */
export function todayISO(): string {
  return localDateISO(localOffsetMinutes());
}

interface SettingsState {
  // Auth
  authToken: string | null;
  userId: string | null;
  userEmail: string | null;
  /**
   * The token belongs to an anonymous trial account (POST /auth/guest), not a
   * registered parent. It is a REAL token — every API call works — but the user
   * has no email/password yet, so routing and the sign-up prompts must still
   * treat them as "not signed up". Registering upgrades the same account.
   */
  isGuestAccount: boolean;
  childId: string | null;

  // Onboarding — parent UI
  parentUILanguage: ParentUILanguage | null;
  learningLanguages: LanguageCode[];
  /** Which learning language the daily course is currently in (when 2 are picked). Null = first. */
  activeLearningLanguage: LanguageCode | null;
  onboardingComplete: boolean;

  // Child profile
  childName: string | null;
  childAge: number | null;
  childAgeBand: AgeBand | null;
  childLevel: ChildLevel | null;
  /** Who this profile is for: a parent-managed kid, or an adult learner on the family account. */
  profileType: ProfileType;
  /** Adult learner goal (travel/career/interview/…) OR a kid's PRIMARY goal; null if none. */
  goal: string | null;
  /** All chosen "why learning" goals (kid path allows up to 2; goal === goalsAll[0]). */
  goalsAll: string[];
  /** Proactive "Bobo messages first" — parent opt-in for kids, default off. */
  proactiveOptIn: boolean;
  /** Last date a sensitive-topic parent alert fired (throttle to ≤1/day). */
  lastSensitiveAlertDate: string | null;
  /** Бобо's color in oklch hue degrees (55=honey, 175=sage, 300=berry, 90=butter). */
  petHue: number;
  /** Free-typed companion name (kid-chosen). Null = use the default brand name. */
  petName: string | null;
  /** Topics the child is interested in — used to personalise lesson stories. */
  childInterests: string[];
  /** What the learner most wants to improve (multi-select) — shapes home + skin. */
  learningFocus: LearningFocus[];
  /** Chosen age range (AZ school-aligned). Drives visual register + engine mode. */
  childAgeRange: AgeRange | null;

  // Schedule
  scheduleDays: ScheduleDay[];
  scheduleMinutes: ScheduleMinutes;
  scheduleHour: number; // 0–23

  // Lesson progress
  currentDay: number;
  totalStars: number;
  lastCompletedDate: string | null; // ISO "2025-01-15"
  streak: number;

  // Daily goal — XP/stars to earn today (Duolingo-style)
  dailyGoal: number;
  starsEarnedToday: number;
  starsResetDate: string | null; // tracks which day starsEarnedToday belongs to
  /** Today-stars stash per child — the active counter above is stashed/restored
   * on profile switch so one child's daily goal never leaks to a sibling. */
  starsTodayByChild: Record<string, { date: string; stars: number }>;
  /**
   * Days already credited, keyed `childId:language:day`. The completion screen
   * runs its award effect on mount with no guard, so re-entering it (back
   * navigation, a re-mount) used to re-add stars and advance the day a SECOND
   * time — skipping a day outright. The server is idempotent per the same key;
   * this is the local half of that.
   */
  creditedLessons: Record<string, true>;

  // Bedtime mode — auto by hour OR manual override
  /** 'off' = always day theme; 'on' = always night; 'auto' = night between 20:00 and 7:00 */
  bedtimeMode: 'off' | 'on' | 'auto';

  // Sound effects (UI chimes; TTS is unaffected)
  soundEnabled: boolean;

  /** Parent gave explicit consent to send the child's voice to AI partners.
   * Required BEFORE any microphone recording (COPPA / Google Play Families).
   * Set true on the consent screen (register path) or when a guest ticks the
   * audio box; the mic is gated on it for un-authenticated (guest) sessions. */
  audioConsent: boolean;

  // Subscription
  isPremium: boolean;

  // Streak freeze — saves the streak when child misses a day. Resets weekly.
  streakFreezesAvailable: number;
  streakFreezesResetDate: string | null; // ISO yyyy-mm-dd

  // Transient lesson session — errors made during current lesson
  currentLessonErrors: LessonError[];

  // Actions
  setAuth: (token: string, userId: string, email: string, isGuest?: boolean) => void;
  setChildId: (id: string | null) => void;
  syncChild: (child: {
    id: string;
    name: string;
    age: number;
    level: string;
    learningLanguages: string[];
    scheduleDays: string[];
    scheduleMinutes: number;
    scheduleHour: number;
    currentDay: number;
    totalStars: number;
    streak: number;
    lastCompletedDate: string | null;
    ageBand?: string;
    petName?: string | null;
    profileType?: string;
    goal?: string | null;
    goals?: string[];
    proactiveOptIn?: number;
  }) => void;
  setActiveLearningLanguage: (lang: LanguageCode) => void;
  setIsPremium: (val: boolean) => void;
  setBedtimeMode: (mode: 'off' | 'on' | 'auto') => void;
  setSoundEnabled: (on: boolean) => void;
  setAudioConsent: (on: boolean) => void;
  recordLessonError: (error: LessonError) => void;
  clearLessonErrors: () => void;
  useStreakFreeze: () => boolean; // returns true if freeze was consumed
  refillStreakFreezes: () => void; // weekly cron-style refill
  logout: () => void;
  setParentUILanguage: (lang: ParentUILanguage) => void;
  setLearningLanguages: (langs: LanguageCode[]) => void;
  setChildProfile: (name: string, age: number, level: ChildLevel) => void;
  setChildAgeBand: (band: AgeBand) => void;
  setProfileType: (type: ProfileType) => void;
  setGoal: (goal: string | null) => void;
  setGoals: (goals: string[]) => void;
  setProactiveOptIn: (on: boolean) => void;
  setLastSensitiveAlertDate: (date: string) => void;
  setPetHue: (hue: number) => void;
  setPetName: (name: string | null) => void;
  setChildInterests: (interests: string[]) => void;
  setLearningFocus: (focus: LearningFocus[]) => void;
  /** Set the chosen age range; also derives representative age + ageBand. */
  setChildAgeRange: (range: AgeRange) => void;
  setSchedule: (days: ScheduleDay[], minutes: ScheduleMinutes, hour: number) => void;
  completeOnboarding: () => void;
  /**
   * Начать настройку нового профиля (первый ребёнок, второй ребёнок, «для себя»).
   * Стирает всё, что относится к ребёнку, и не трогает аккаунт.
   */
  startNewProfileSetup: (type: ProfileType) => void;
  addStars: (n: number) => void;
  setDailyGoal: (goal: number) => void;
  advanceDay: (completedDay?: number) => void;
  markTodayComplete: (tzOffsetMinutes?: number) => void;
  /** True the first time this (child, language, day) is credited; false after. */
  claimLessonCredit: (childId: string, language: string, day: number) => boolean;
  /** Adopt the server's authoritative totals after a POST /progress. */
  applyServerProgress: (r: { totalStars?: number; streak?: number; currentDay?: number }) => void;
  reset: () => void;
}

const DEFAULT_DAYS: ScheduleDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

const INITIAL: Omit<SettingsState,
  | 'setAuth' | 'setChildId' | 'syncChild' | 'setIsPremium' | 'logout'
  | 'setParentUILanguage' | 'setLearningLanguages' | 'setChildProfile' | 'setChildAgeBand' | 'setPetHue'
  | 'setSchedule' | 'completeOnboarding' | 'startNewProfileSetup' | 'addStars' | 'setDailyGoal' | 'advanceDay'
  | 'markTodayComplete' | 'claimLessonCredit' | 'applyServerProgress' | 'reset'
  | 'recordLessonError' | 'clearLessonErrors'
  | 'useStreakFreeze' | 'refillStreakFreezes' | 'setChildInterests'
  | 'setBedtimeMode' | 'setSoundEnabled' | 'setAudioConsent' | 'setProfileType' | 'setGoal' | 'setGoals' | 'setProactiveOptIn'
  | 'setLastSensitiveAlertDate' | 'setActiveLearningLanguage'
  | 'setPetName' | 'setLearningFocus' | 'setChildAgeRange'
> = {
  authToken: null,
  userId: null,
  userEmail: null,
  isGuestAccount: false,
  childId: null,
  parentUILanguage: null,
  learningLanguages: [],
  activeLearningLanguage: null,
  onboardingComplete: false,
  childName: null,
  childAge: null,
  childAgeBand: null,
  childLevel: null,
  profileType: 'kid',
  goal: null,
  goalsAll: [],
  proactiveOptIn: false,
  lastSensitiveAlertDate: null,
  petHue: 55,
  petName: null,
  childInterests: [],
  learningFocus: [],
  childAgeRange: null,
  scheduleDays: DEFAULT_DAYS,
  scheduleMinutes: 15,
  scheduleHour: 17,
  currentDay: 1,
  totalStars: 0,
  lastCompletedDate: null,
  streak: 0,
  dailyGoal: 15,
  starsEarnedToday: 0,
  starsResetDate: null,
  starsTodayByChild: {},
  creditedLessons: {},
  isPremium: false,
  bedtimeMode: 'auto',
  soundEnabled: true,
  audioConsent: false,
  streakFreezesAvailable: 1,
  streakFreezesResetDate: null,
  currentLessonErrors: [],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setAuth: (token, userId, email, isGuest = false) =>
        set({ authToken: token, userId, userEmail: email, isGuestAccount: isGuest }),
      setChildId: (id) => set({ childId: id }),
      syncChild: (child) =>
        set((s) => {
          // Daily-goal counter is device-local (not on the server): stash the
          // outgoing child's today-stars and restore the incoming child's, so
          // switching profiles never shows a sibling's "goal reached".
          const today = todayISO();
          const stash = { ...s.starsTodayByChild };
          if (s.childId && s.childId !== child.id) {
            stash[s.childId] = { date: s.starsResetDate ?? today, stars: s.starsEarnedToday };
          }
          const restored = stash[child.id];
          const restoredStars =
            s.childId === child.id
              ? s.starsEarnedToday // same child re-sync — keep the live counter
              : restored && restored.date === today
                ? restored.stars
                : 0;
          // Progress is monotonic for the SAME child. A completion finished
          // offline is still sitting in the outbox, so the server's copy is
          // legitimately behind — taking it verbatim made the lesson visibly
          // un-complete itself until the queue flushed. Take whichever is further
          // along; the flush then converges both on the server's number.
          // A DIFFERENT child is a fresh profile: adopt the server's values as-is,
          // or one sibling's progress would leak onto another.
          const sameChild = s.childId === child.id;
          return {
          starsTodayByChild: stash,
          starsEarnedToday: restoredStars,
          starsResetDate: today,
          currentLessonErrors: s.childId === child.id ? s.currentLessonErrors : [],
          childId: child.id,
          childName: child.name,
          childAge: child.age,
          learningLanguages: child.learningLanguages as LanguageCode[],
          scheduleDays: child.scheduleDays as ScheduleDay[],
          scheduleMinutes: child.scheduleMinutes as ScheduleMinutes,
          scheduleHour: child.scheduleHour,
          currentDay: sameChild ? Math.max(s.currentDay, child.currentDay) : child.currentDay,
          totalStars: sameChild ? Math.max(s.totalStars, child.totalStars) : child.totalStars,
          streak: sameChild ? Math.max(s.streak, child.streak) : child.streak,
          // Same reasoning as the three above: an offline completion has already
          // moved this forward locally, and ISO yyyy-mm-dd sorts lexicographically
          // so the later date is simply the greater string.
          lastCompletedDate:
            sameChild && s.lastCompletedDate && child.lastCompletedDate
              ? (s.lastCompletedDate > child.lastCompletedDate
                  ? s.lastCompletedDate
                  : child.lastCompletedDate)
              : (child.lastCompletedDate ?? (sameChild ? s.lastCompletedDate : null)),
          onboardingComplete: true,
          // Hydrate server-side fields so adult/proactive state survives relaunch & profile switch
          profileType: (child.profileType === 'adult' ? 'adult' : 'kid') as ProfileType,
          goal: child.goal ?? null,
          goalsAll: child.goals?.length ? child.goals : child.goal ? [child.goal] : [],
          proactiveOptIn: child.proactiveOptIn === 1,
          childAgeBand: (child.ageBand as AgeBand | undefined) ?? null,
          childLevel: normalizeLevel(child.level),
          petName: child.petName ?? null,
          };
        }),
      setIsPremium: (val) => set({ isPremium: val }),
      setBedtimeMode: (mode) => set({ bedtimeMode: mode }),
      setSoundEnabled: (on) => set({ soundEnabled: on }),
      setAudioConsent: (on) => set({ audioConsent: on }),
      recordLessonError: (error) =>
        set((s) => ({ currentLessonErrors: [...s.currentLessonErrors, error] })),
      clearLessonErrors: () => set({ currentLessonErrors: [] }),
      useStreakFreeze: () => {
        const s = useSettings.getState();
        if (s.streakFreezesAvailable <= 0) return false;
        set({
          streakFreezesAvailable: s.streakFreezesAvailable - 1,
          // Pretend "yesterday" was completed so the streak chain stays intact.
          // Must be the LOCAL yesterday — nextStreak() compares against the local
          // calendar, so a UTC value here would miss the chain it exists to save.
          lastCompletedDate: localYesterdayISO(localOffsetMinutes()),
        });
        return true;
      },
      refillStreakFreezes: () =>
        set((s) => {
          const today = todayISO();
          // Only refill if a week has passed since last reset
          if (s.streakFreezesResetDate) {
            const last = new Date(s.streakFreezesResetDate).getTime();
            const now = Date.now();
            if (now - last < 7 * 86400000) return {};
          }
          return { streakFreezesAvailable: 1, streakFreezesResetDate: today };
        }),
      logout: () => {
        // Clear everything except UI language preference — user shouldn't
        // have to re-pick language. Persist writes the cleared state to
        // AsyncStorage, so re-launch won't silently restore old session.
        const lang = useSettings.getState().parentUILanguage;
        set({ ...INITIAL, parentUILanguage: lang });
      },

      setParentUILanguage: (lang) => set({ parentUILanguage: lang }),
      setLearningLanguages: (langs) => set({ learningLanguages: langs }),
      setActiveLearningLanguage: (lang) => set({ activeLearningLanguage: lang }),
      setChildProfile: (name, age, level) =>
        set({ childName: name, childAge: age, childLevel: level }),
      setChildAgeBand: (band) => set({ childAgeBand: band }),
      setProfileType: (type) =>
        set(type === 'adult' ? { profileType: type, childAgeBand: 'adult' } : { profileType: type }),
      setGoal: (goal) => set({ goal }),
      setGoals: (goals) => set({ goalsAll: goals, goal: goals[0] ?? null }),
      setProactiveOptIn: (on) => set({ proactiveOptIn: on }),
      setLastSensitiveAlertDate: (date) => set({ lastSensitiveAlertDate: date }),
      setPetHue: (hue) => set({ petHue: hue }),
      setPetName: (name) => set({ petName: name }),
      setChildInterests: (interests) => set({ childInterests: interests }),
      setLearningFocus: (focus) => set({ learningFocus: focus }),
      setChildAgeRange: (range) => {
        const meta = AGE_RANGE_META[range];
        set({ childAgeRange: range, childAgeBand: meta.band, childAge: meta.repAge });
      },
      setSchedule: (days, minutes, hour) =>
        set({ scheduleDays: days, scheduleMinutes: minutes, scheduleHour: hour }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      // Всё, что принадлежит ребёнку, возвращается к INITIAL. Без этого имя
      // питомца из прошлого профиля (petName лежит в AsyncStorage) всплывало в
      // новом онбординге — баг «Ппп» с device QA. Аккаунт, язык интерфейса,
      // согласие, премиум и настройки звука остаются: это не про ребёнка.
      startNewProfileSetup: (type) =>
        set({
          childId: null,
          childName: null,
          childAge: null,
          childAgeBand: type === 'adult' ? 'adult' : null,
          childAgeRange: null,
          childLevel: null,
          profileType: type,
          goal: INITIAL.goal,
          goalsAll: INITIAL.goalsAll,
          proactiveOptIn: INITIAL.proactiveOptIn,
          petHue: INITIAL.petHue,
          petName: INITIAL.petName,
          childInterests: INITIAL.childInterests,
          learningFocus: INITIAL.learningFocus,
          scheduleDays: INITIAL.scheduleDays,
          scheduleMinutes: INITIAL.scheduleMinutes,
          scheduleHour: INITIAL.scheduleHour,
          activeLearningLanguage: INITIAL.activeLearningLanguage,
          currentDay: INITIAL.currentDay,
          totalStars: INITIAL.totalStars,
          lastCompletedDate: INITIAL.lastCompletedDate,
          streak: INITIAL.streak,
          starsEarnedToday: INITIAL.starsEarnedToday,
          starsResetDate: INITIAL.starsResetDate,
          currentLessonErrors: INITIAL.currentLessonErrors,
        }),
      addStars: (n) =>
        set((s) => {
          const today = todayISO();
          // If first stars of the day, reset the daily counter
          const isNewDay = s.starsResetDate !== today;
          const newToday = (isNewDay ? 0 : s.starsEarnedToday) + n;
          return {
            totalStars: s.totalStars + n,
            starsEarnedToday: newToday,
            starsResetDate: today,
          };
        }),
      setDailyGoal: (goal) => set({ dailyGoal: Math.max(5, Math.min(60, goal)) }),
      // Cap at 120 (not 30) so progression continues into the AI-generated weeks
      // (days 31+) — capping at 30 stranded the entire generatedWeeks subsystem.
      //
      // Only an OPTIMISTIC step for the offline case; the server returns the real
      // value from POST /progress and applyServerProgress() adopts it. The two
      // used to disagree — this advanced currentDay+1 while the server set
      // day+1 — and since hydrate() takes the server's number, replaying an old
      // day silently threw away everything since.
      advanceDay: (completedDay?: number) =>
        set((s) => ({
          currentDay: Math.min(
            Math.max(s.currentDay, (completedDay ?? s.currentDay) + 1),
            120,
          ),
        })),
      markTodayComplete: (tzOffsetMinutes) =>
        set((s) => {
          const tz = tzOffsetMinutes ?? localOffsetMinutes();
          // Shared with the server (@soz/shared-types) so the optimistic value
          // matches what hydrate() will later bring back. The old inline rule
          // compared only against yesterday, so a SECOND lesson on the same day
          // fell through to 1 and reset the streak.
          return {
            lastCompletedDate: localDateISO(tz),
            streak: nextStreak(s.streak, s.lastCompletedDate, tz),
          };
        }),
      claimLessonCredit: (childId, language, day) => {
        const key = `${childId}:${language}:${day}`;
        if (useSettings.getState().creditedLessons[key]) return false;
        set((s) => ({ creditedLessons: { ...s.creditedLessons, [key]: true } }));
        return true;
      },
      applyServerProgress: (r) =>
        set((s) => ({
          totalStars: r.totalStars ?? s.totalStars,
          streak: r.streak ?? s.streak,
          currentDay: r.currentDay ?? s.currentDay,
        })),
      reset: () => set(INITIAL),
    }),
    {
      name: 'soz-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
