/**
 * Transcript retention.
 *
 * The privacy policy promised that conversation transcripts are deleted
 * automatically — and nothing in the codebase did it. Every word a child ever
 * said to Бобо stayed in `conversations` until the parent deleted the whole
 * account. This makes the promise true.
 *
 * Scope is deliberately just transcripts. Бобо's memory of the child (facts,
 * interests, follow-up threads) is a separate table and a separate promise; the
 * crisis records in `safety_alerts` carry no transcript and are kept as an audit
 * trail.
 *
 * Runs in-process once a day (and once at boot). With one Fly machine that is
 * exactly one run; a second machine would just find nothing left to delete.
 */

import { lt, sql } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { conversations } from '../db/schema.js';

const DEFAULT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionDays(): number {
  const n = Number(process.env.TRANSCRIPT_RETENTION_DAYS ?? '');
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAYS;
}

/** Delete transcripts not touched in `days`. Returns how many rows went. */
export async function purgeOldConversations(
  days = retentionDays(),
  now = new Date(),
): Promise<number> {
  if (!isDbAvailable()) return 0;
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  // updated_at, not created_at: a conversation the child keeps returning to is
  // still live, and its age is measured from the last turn.
  const rows = await getDb()
    .delete(conversations)
    .where(lt(conversations.updatedAt, cutoff))
    .returning({ id: conversations.id });
  return rows.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startRetentionJob(): void {
  if (timer) return;
  const run = async () => {
    try {
      const n = await purgeOldConversations();
      console.log(`[retention] purged ${n} transcript(s) older than ${retentionDays()} days`);
    } catch (e) {
      // Loud: a silently failing purge means the policy is being broken again.
      console.error('[retention] purge failed:', e);
    }
  };
  // A short delay at boot so the first run does not race the migration.
  setTimeout(run, 30_000).unref();
  timer = setInterval(run, DAY_MS);
  timer.unref();
}

/** Rows currently past the cutoff — for a health/ops readout without deleting. */
export async function countOverdueConversations(days = retentionDays()): Promise<number> {
  if (!isDbAvailable()) return 0;
  const cutoff = new Date(Date.now() - days * DAY_MS);
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(lt(conversations.updatedAt, cutoff));
  return row?.n ?? 0;
}
