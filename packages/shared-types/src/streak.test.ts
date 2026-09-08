/**
 * Streak rules — the logic that decides whether a child keeps their chain.
 *
 * Worth testing above almost anything else here: the rule is duplicated in
 * spirit across the app and the API, it is invisible when wrong (nobody notices
 * a streak reset until a child is upset about it), and the previous version had
 * two real bugs that these cases pin down — a second lesson on the same day
 * resetting the chain to 1, and UTC dates breaking evening learners in UTC+4.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { localDateISO, localOffsetMinutes, localYesterdayISO, nextStreak } from './streak.js';

const BAKU = 240; // UTC+4

describe('localDateISO', () => {
  it('returns the UTC day at offset 0', () => {
    assert.equal(localDateISO(0, new Date('2026-08-24T13:00:00Z')), '2026-08-24');
  });

  it('rolls into tomorrow once local time passes midnight', () => {
    // 21:30 UTC is 01:30 the NEXT day in Baku.
    assert.equal(localDateISO(BAKU, new Date('2026-08-24T21:30:00Z')), '2026-08-25');
  });

  it('keeps a late-evening session on the same local day', () => {
    // 18:00 UTC is 22:00 local — still the 24th. The old UTC-based code agreed
    // here, which is why the bug looked intermittent rather than constant.
    assert.equal(localDateISO(BAKU, new Date('2026-08-24T18:00:00Z')), '2026-08-24');
  });

  it('handles negative offsets (western hemisphere)', () => {
    // 02:00 UTC is 21:00 the PREVIOUS day in New York (-300).
    assert.equal(localDateISO(-300, new Date('2026-08-24T02:00:00Z')), '2026-08-23');
  });
});

describe('localYesterdayISO', () => {
  it('is the local day before localDateISO', () => {
    const at = new Date('2026-08-24T21:30:00Z'); // 01:30 on the 25th in Baku
    assert.equal(localDateISO(BAKU, at), '2026-08-25');
    assert.equal(localYesterdayISO(BAKU, at), '2026-08-24');
  });

  it('crosses a month boundary', () => {
    assert.equal(localYesterdayISO(0, new Date('2026-09-01T10:00:00Z')), '2026-08-31');
  });
});

describe('localOffsetMinutes', () => {
  it('inverts getTimezoneOffset so the sign matches the helpers', () => {
    const at = new Date('2026-08-24T12:00:00Z');
    assert.equal(localOffsetMinutes(at), -at.getTimezoneOffset());
  });
});

describe('nextStreak', () => {
  const at = new Date('2026-08-24T18:00:00Z'); // 22:00 in Baku
  const today = localDateISO(BAKU, at);
  const yesterday = localYesterdayISO(BAKU, at);

  it('starts at 1 for a first-ever lesson', () => {
    assert.equal(nextStreak(0, null, BAKU, at), 1);
  });

  it('continues the chain from yesterday', () => {
    assert.equal(nextStreak(5, yesterday, BAKU, at), 6);
  });

  it('leaves the streak alone on a SECOND lesson the same day', () => {
    // The regression that mattered most: the old rule only compared against
    // yesterday, so `today !== yesterday` fell through to 1 — practising twice
    // in one day reset the chain the feature exists to reward.
    assert.equal(nextStreak(5, today, BAKU, at), 5);
  });

  it('does not report 0 if somehow called with a zero streak already marked today', () => {
    assert.equal(nextStreak(0, today, BAKU, at), 1);
  });

  it('resets to 1 after a missed day', () => {
    assert.equal(nextStreak(9, '2026-08-22', BAKU, at), 1);
  });

  it('resets to 1 for a long gap', () => {
    assert.equal(nextStreak(30, '2026-01-01', BAKU, at), 1);
  });

  it('treats undefined like null', () => {
    assert.equal(nextStreak(4, undefined, BAKU, at), 1);
  });

  it('keeps an evening learner in UTC+4 on their chain', () => {
    // Yesterday's lesson at 22:00 local was stored as the local day. Tonight at
    // 22:00 local the chain must continue. Computing either side in UTC would
    // make these dates disagree and silently reset the streak.
    const lastNight = new Date('2026-08-23T18:00:00Z');
    const lastCompleted = localDateISO(BAKU, lastNight);
    assert.equal(nextStreak(3, lastCompleted, BAKU, at), 4);
  });

  it('survives a full week of consecutive evening sessions', () => {
    let streak = 0;
    let last: string | null = null;
    for (let d = 0; d < 7; d++) {
      const when = new Date(Date.UTC(2026, 7, 18 + d, 18, 0, 0)); // 22:00 Baku
      streak = nextStreak(streak, last, BAKU, when);
      last = localDateISO(BAKU, when);
    }
    assert.equal(streak, 7);
  });

  it('does not inflate when a day is practised three times', () => {
    const when = new Date('2026-08-24T18:00:00Z');
    let streak = nextStreak(2, yesterday, BAKU, when); // 3
    const last = localDateISO(BAKU, when);
    streak = nextStreak(streak, last, BAKU, when);
    streak = nextStreak(streak, last, BAKU, when);
    assert.equal(streak, 3);
  });
});
