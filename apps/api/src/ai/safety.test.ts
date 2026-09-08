/**
 * The real-time child-safety screen.
 *
 * What is being guarded here is an escalation path, not a feature: the screen
 * used to swallow every classifier error and return "safe", so a single OpenAI
 * blip turned a child saying "папа меня бьёт" into an ordinary cheerful tutor
 * reply with no alert to anyone — and nothing in the logs said so. These tests
 * pin the two properties that failure taught us to require: a transient error is
 * retried, and an unreachable classifier still escalates the highest-signal
 * phrases instead of failing silently.
 *
 * ./llm.js is stubbed — this is about the screen's control flow, not about
 * OpenAI.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

// ── Stub, registered before the module under test is imported ────────────────

interface Call {
  timeoutMs?: number;
  maxTokens?: number;
  childMessage: string;
}

/** Outcomes the fake classifier produces, in order. Anything past the end repeats
 *  the last one, so "always fails" needs no padding. */
let outcomes: Array<string | Error> = [];
let calls: Call[] = [];

mock.module('./llm.js', {
  namedExports: {
    generateBoboReply: async (args: Call) => {
      calls.push({
        timeoutMs: args.timeoutMs,
        maxTokens: args.maxTokens,
        childMessage: args.childMessage,
      });
      const next = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
      if (next instanceof Error) throw next;
      return {
        text: next ?? '{"crisis":false,"concerning":false,"category":"none"}',
        durationMs: 1,
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  },
});

const { keywordCrisisScreen, screenChildMessage } = await import('./safety.js');

const verdict = (o: Record<string, unknown>) => JSON.stringify(o);
const CRISIS = verdict({ crisis: true, concerning: true, category: 'abuse' });
const NONE = verdict({ crisis: false, concerning: false, category: 'none' });

// ─────────────────────────────────────────────────────────────────────────────

describe('keyword fallback', () => {
  // Every Cyrillic pattern was originally written with \b, which in JS is defined
  // over [A-Za-z0-9_] only — /\bпапа/ never matches "папа меня бьёт" because
  // there is no \w before the 'п'. The whole ru half of the fallback was dead and
  // silently matched nothing, which is precisely the kind of failure it exists to
  // prevent. These cases fail loudly if that regression comes back.
  const flagged = [
    'папа меня бьёт',
    'Мой папа бьет меня каждый день',
    'меня бьют в школе',
    'я не хочу жить',
    'хочу умереть',
    'my dad hits me',
    'i want to die',
    'I want to hurt myself',
    'he touches me there',
  ];
  for (const text of flagged) {
    it(`flags: ${text}`, () => assert.equal(keywordCrisisScreen(text), true));
  }

  // A false positive costs one neutral email; over-flagging ordinary kid talk
  // trains parents to ignore the alert, which costs much more.
  const ignored = [
    'я убил босса в игре',
    'мой брат играет в майнкрафт',
    'I killed the dragon in Minecraft',
    'my dad hits the ball really far',
    'I hurt my knee playing football',
    'this game is so hard I want to cry',
  ];
  for (const text of ignored) {
    it(`ignores: ${text}`, () => assert.equal(keywordCrisisScreen(text), false));
  }
});

describe('screenChildMessage', () => {
  beforeEach(() => {
    outcomes = [];
    calls = [];
  });

  it('returns the classifier verdict and does not retry on success', async () => {
    outcomes = [CRISIS];
    const res = await screenChildMessage('something happened', 'en');
    assert.equal(res.crisis, true);
    assert.equal(res.category, 'abuse');
    assert.equal(res.degraded, undefined);
    assert.equal(calls.length, 1);
  });

  it('bounds each attempt so a stalled classifier cannot freeze the reply', async () => {
    outcomes = [NONE];
    await screenChildMessage('hello there', 'en');
    assert.ok(calls[0]!.timeoutMs && calls[0]!.timeoutMs <= 5_000, 'a per-attempt timeout is set');
  });

  it('retries a transient failure instead of reporting safe', async () => {
    outcomes = [new Error('ECONNRESET'), CRISIS];
    const res = await screenChildMessage('папа меня бьёт', 'ru');
    assert.equal(calls.length, 2);
    assert.equal(res.crisis, true);
    assert.equal(res.degraded, undefined, 'the classifier answered — not degraded');
  });

  it('retries a malformed reply — unparseable is a failure, not a "safe"', async () => {
    outcomes = ['not json at all', CRISIS];
    const res = await screenChildMessage('something happened', 'en');
    assert.equal(calls.length, 2);
    assert.equal(res.crisis, true);
  });

  it('still escalates a crisis phrase when the classifier is unreachable', async () => {
    outcomes = [new Error('503 upstream unavailable')];
    const res = await screenChildMessage('папа меня бьёт каждый день', 'ru');
    assert.equal(res.crisis, true, 'the old code returned safe here and told no one');
    assert.equal(res.category, 'keyword_fallback');
    assert.equal(res.degraded, true, 'the alert is marked lower-confidence');
  });

  it('marks an unreachable classifier degraded even when nothing is flagged', async () => {
    outcomes = [new Error('503 upstream unavailable')];
    const res = await screenChildMessage('I played football today', 'en');
    assert.equal(res.crisis, false);
    assert.equal(res.degraded, true, 'a run of these is how an outage becomes visible');
  });

  it('never calls the classifier for an empty transcript', async () => {
    const res = await screenChildMessage('  ', 'en');
    assert.equal(res.crisis, false);
    assert.equal(calls.length, 0);
  });
});
