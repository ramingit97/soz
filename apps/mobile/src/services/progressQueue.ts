/**
 * Durable outbox for lesson completions.
 *
 * Completing a lesson used to be `recordProgress(...).catch(() => {})`: a child
 * finishing a lesson on the metro lost it outright, and the next hydrate pulled
 * the server's older numbers back down over the local ones — so the lesson
 * visibly un-completed itself. Progress is the one thing in this app that must
 * not evaporate, so it goes through a queue instead.
 *
 * The queue is safe to flush aggressively because POST /progress is idempotent
 * per (childId, language, day): a completion delivered twice is a no-op that
 * returns `duplicate: true`, so retrying costs nothing and losing the response
 * is never harmful.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordProgress, type LessonError, type ProgressResult } from './api';

const KEY = 'soz-progress-queue-v1';
/** Stop growing the backlog if something is badly wrong; oldest are dropped. */
const MAX_ENTRIES = 200;

export interface PendingProgress {
  childId: string;
  language: string;
  day: number;
  starsEarned: number;
  errors: LessonError[];
  tzOffsetMinutes: number;
  /** ms epoch — for ordering and for dropping the oldest when capped. */
  queuedAt: number;
}

async function readQueue(): Promise<PendingProgress[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingProgress[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingProgress[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ENTRIES)));
  } catch {
    /* storage full — the in-flight attempt below is still the common path */
  }
}

export async function enqueueProgress(entry: PendingProgress): Promise<void> {
  const queue = await readQueue();
  // Same (child, language, day) already waiting → keep one. The server would
  // dedupe anyway, but this stops a retry loop from growing the backlog.
  const deduped = queue.filter(
    (q) => !(q.childId === entry.childId && q.language === entry.language && q.day === entry.day),
  );
  deduped.push(entry);
  await writeQueue(deduped);
}

/**
 * Try to deliver everything queued. Entries that fail stay queued for the next
 * attempt; entries the server accepts (or rejects as permanently invalid) are
 * dropped.
 *
 * Returns the newest successful server response, so the caller can converge its
 * local totals on the server's authoritative numbers.
 */
export async function flushProgressQueue(token: string): Promise<ProgressResult | null> {
  const queue = await readQueue();
  if (queue.length === 0) return null;

  const remaining: PendingProgress[] = [];
  let latest: ProgressResult | null = null;

  for (const entry of queue) {
    try {
      latest = await recordProgress(entry, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // 4xx that isn't 429 means this entry will never succeed (deleted child,
      // revoked token, malformed payload) — retrying it forever would block the
      // queue behind a permanently poisoned item.
      const permanent = /\b4(0[0-9]|1[0-8])\b/.test(msg);
      if (!permanent) remaining.push(entry);
    }
  }

  await writeQueue(remaining);
  return latest;
}

/** How many completions are still undelivered (for a "not synced yet" hint). */
export async function pendingProgressCount(): Promise<number> {
  return (await readQueue()).length;
}
