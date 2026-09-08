/**
 * Daily AI spend — the number that used to exist nowhere.
 *
 * Every AI call computed a cost, returned it to the client, and forgot it. The
 * only place the total ever appeared was the provider invoice, weeks later. For
 * a solo founder that is the difference between noticing a runaway loop at
 * lunchtime and noticing it on the credit card.
 *
 * Two layers, deliberately:
 *  - an in-memory tally for the alert — cheap, per-process, resets on restart;
 *  - a one-row-per-day upsert in Postgres so the history survives deploys and
 *    can be read with a single query.
 *
 * Alerting is soft: log + Sentry once per day when AI_DAILY_BUDGET_USD is
 * crossed. It does NOT refuse calls — turning the product off because a good
 * day exceeded a guess is a policy decision, not a default.
 */

import { sql } from 'drizzle-orm';

import { llmCost } from '../ai/cost.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { aiSpendDaily } from '../db/schema.js';

export type SpendKind = 'llm' | 'stt' | 'tts';

const budgetUsd = Number(process.env.AI_DAILY_BUDGET_USD ?? '');
const BUDGET = Number.isFinite(budgetUsd) && budgetUsd > 0 ? budgetUsd : null;

let tallyDate = '';
let tallyUsd = 0;
let tallyCalls = 0;
let alertedFor = '';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollover(): void {
  const today = todayUTC();
  if (today !== tallyDate) {
    tallyDate = today;
    tallyUsd = 0;
    tallyCalls = 0;
  }
}

/** Record one call's estimated cost. Never throws; never awaited on the hot path. */
export function recordSpend(kind: SpendKind, usd: number, model?: string): void {
  if (!Number.isFinite(usd) || usd < 0) return;
  rollover();
  tallyUsd += usd;
  tallyCalls += 1;

  if (BUDGET !== null && tallyUsd > BUDGET && alertedFor !== tallyDate) {
    alertedFor = tallyDate;
    const msg = `[spend] AI budget exceeded: $${tallyUsd.toFixed(2)} of $${BUDGET} today (${tallyCalls} calls since last restart)`;
    console.error(msg);
    if (process.env.SENTRY_DSN) {
      import('@sentry/node')
        .then((Sentry) => Sentry.captureMessage(msg, 'warning'))
        .catch(() => {});
    }
  }

  persist(kind, usd, model).catch((e) => {
    // The in-memory tally already has it; the row is best-effort — but say so,
    // or a broken upsert would quietly under-report spend forever.
    console.warn('[spend] persist failed:', e instanceof Error ? e.message : e);
  });
}

async function persist(kind: SpendKind, usd: number, model: string | undefined): Promise<void> {
  if (!isDbAvailable()) return;
  const day = todayUTC();
  const key = model ? `${kind}:${model}` : kind;
  // One row per UTC day; per-kind breakdown lives in a jsonb map so adding a
  // provider never needs a migration.
  await getDb()
    .insert(aiSpendDaily)
    .values({ day, usd, calls: 1, byKind: { [key]: usd } })
    .onConflictDoUpdate({
      target: aiSpendDaily.day,
      set: {
        usd: sql`${aiSpendDaily.usd} + ${usd}`,
        calls: sql`${aiSpendDaily.calls} + 1`,
        byKind: sql`${aiSpendDaily.byKind} || jsonb_build_object(${key}::text, coalesce((${aiSpendDaily.byKind}->>${key}::text)::numeric, 0) + ${usd})`,
        updatedAt: sql`now()`,
      },
    });
}

/** What this process has seen today. For /health and tests. */
export function spendToday(): {
  day: string;
  usd: number;
  calls: number;
  budgetUsd: number | null;
} {
  rollover();
  return { day: tallyDate, usd: tallyUsd, calls: tallyCalls, budgetUsd: BUDGET };
}

/** Test seam. */
export function resetSpendTally(): void {
  tallyDate = '';
  tallyUsd = 0;
  tallyCalls = 0;
  alertedFor = '';
}

/**
 * Convenience for the call sites that talk to the OpenAI SDK directly (not
 * through generateBoboReply): attribute a completion's usage block.
 */
export function trackLlmUsage(
  model: string,
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  } | null,
): void {
  if (!usage) return;
  recordSpend(
    'llm',
    llmCost(model, {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    }),
    model,
  );
}
