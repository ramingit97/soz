/**
 * The daily tally and its alert. The DB row is exercised by the integration
 * suite; this pins the in-process behaviour that fires the warning.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

process.env.AI_DAILY_BUDGET_USD = '1';
delete process.env.SENTRY_DSN;

// No DB in this test — the persist path returns immediately.
mock.module('../db/client.js', {
  namedExports: {
    isDbAvailable: () => false,
    getDb: () => {
      throw new Error('no db');
    },
  },
});

const { recordSpend, resetSpendTally, spendToday, trackLlmUsage } = await import('./spend.js');

describe('spend tally', () => {
  beforeEach(() => resetSpendTally());

  it('sums calls for today', () => {
    recordSpend('llm', 0.25, 'gpt-5.6-terra');
    recordSpend('tts', 0.05);
    const t = spendToday();
    assert.equal(+t.usd.toFixed(2), 0.3);
    assert.equal(t.calls, 2);
    assert.equal(t.budgetUsd, 1);
  });

  it('ignores garbage amounts', () => {
    recordSpend('llm', NaN);
    recordSpend('llm', -5);
    assert.equal(spendToday().calls, 0);
  });

  it('alerts once when the budget is crossed, not on every call after', () => {
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void errors.push(a.join(' '));
    try {
      recordSpend('llm', 0.6);
      recordSpend('llm', 0.6); // crosses $1
      recordSpend('llm', 0.6);
      recordSpend('llm', 0.6);
    } finally {
      console.error = orig;
    }
    const alerts = errors.filter((e) => e.includes('AI budget exceeded'));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0]!, /\$1\.20 of \$1/);
  });

  it('attributes an OpenAI usage block through trackLlmUsage', () => {
    trackLlmUsage('gpt-4o-mini', { prompt_tokens: 1_000_000, completion_tokens: 0 });
    assert.equal(+spendToday().usd.toFixed(2), 0.15);
  });
});
