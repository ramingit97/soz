/**
 * Calendar-day helpers for streaks — SHARED by the API and the mobile app.
 *
 * It lives in @soz/shared-types precisely because both sides compute it: the app
 * needs an optimistic value while offline, the server owns the authoritative
 * one, and when the two disagreed the server's value overwrote the client's on
 * the next hydrate. Two copies of this rule is how the streak silently reset.
 *
 * Streaks are a *local* notion — "did you practise today?" means the learner's
 * today, not UTC's. The audience is UTC+4, so computing days with
 * `new Date().toISOString()` moved every session after 20:00 local into the next
 * day and broke streaks for exactly the evening users the schedule targets.
 *
 * `offsetMinutes` follows the ISO/POSIX-positive convention: minutes to ADD to
 * UTC to get local time (Baku = +240). Note this is the negation of JavaScript's
 * `Date.prototype.getTimezoneOffset()`, which returns -240 there — use
 * `localOffsetMinutes()` rather than passing that value directly.
 */

/**
 * This device's UTC offset in the positive convention these helpers expect.
 * `getTimezoneOffset()` returns the opposite sign, which is the easiest way to
 * get this exactly backwards.
 */
export function localOffsetMinutes(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}

/** ISO `yyyy-mm-dd` for the calendar day `at` falls on at the given offset. */
export function localDateISO(offsetMinutes = 0, at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** The local calendar day before `localDateISO(...)`. */
export function localYesterdayISO(offsetMinutes = 0, at: Date = new Date()): string {
  return localDateISO(offsetMinutes, new Date(at.getTime() - 86_400_000));
}

/**
 * Next streak value after completing a lesson.
 *
 * The rule the old code got wrong: a SECOND lesson on the same day must leave the
 * streak alone. It compared only against yesterday, so `today !== yesterday` fell
 * through to `1` and reset the streak to 1 every time a child practised twice in
 * one day — which is exactly the behaviour the feature is meant to reward.
 */
export function nextStreak(
  currentStreak: number,
  lastCompletedDate: string | null | undefined,
  offsetMinutes = 0,
  at: Date = new Date(),
): number {
  const today = localDateISO(offsetMinutes, at);
  const yesterday = localYesterdayISO(offsetMinutes, at);

  if (lastCompletedDate === today) return Math.max(currentStreak, 1); // already counted today
  if (lastCompletedDate === yesterday) return currentStreak + 1; // chain continues
  return 1; // first ever, or the chain broke
}
