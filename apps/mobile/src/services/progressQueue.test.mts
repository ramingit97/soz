/**
 * Offline outbox for lesson completions.
 *
 * The failure this guards against is silent and unrecoverable: a child finishes
 * a lesson with no signal, the POST fails, and the completion is gone — then the
 * next hydrate pulls the server's older totals back over the local ones and the
 * lesson visibly un-completes itself. So the queue's contract is tested rather
 * than assumed: nothing is dropped on a transient failure, retries don't
 * duplicate, and one permanently-rejected entry can't wedge the rest behind it.
 *
 * AsyncStorage and ./api are stubbed — this is about the queue's behaviour, not
 * about React Native or the network.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

// ── Stubs ────────────────────────────────────────────────────────────────────
// Registered before the module under test is imported so it picks them up.

const store = new Map<string, string>();

mock.module('@react-native-async-storage/async-storage', {
  defaultExport: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
});

/** Queue of outcomes the fake recordProgress will produce, in order. */
let outcomes: Array<'ok' | 'network' | 'gone'> = [];
let attempts: Array<{ day: number }> = [];

mock.module('./api.js', {
  namedExports: {
    recordProgress: async (input: { day: number }) => {
      attempts.push({ day: input.day });
      const outcome = outcomes.shift() ?? 'ok';
      if (outcome === 'network') throw new Error('Network request failed');
      if (outcome === 'gone') throw new Error('404 child_not_found');
      return { ok: true, totalStars: 10, streak: 1, currentDay: input.day + 1 };
    },
  },
});

const { enqueueProgress, flushProgressQueue, pendingProgressCount } = await import(
  './progressQueue.js'
);

const entry = (day: number) => ({
  childId: 'child-1',
  language: 'en',
  day,
  starsEarned: 10,
  errors: [],
  tzOffsetMinutes: 240,
  queuedAt: 1_700_000_000_000 + day,
});

describe('progress queue', () => {
  beforeEach(() => {
    store.clear();
    outcomes = [];
    attempts = [];
  });

  it('starts empty and flushing is a no-op', async () => {
    assert.equal(await pendingProgressCount(), 0);
    assert.equal(await flushProgressQueue('token'), null);
  });

  it('keeps a completion that failed to send', async () => {
    await enqueueProgress(entry(3));
    assert.equal(await pendingProgressCount(), 1);
  });

  it('delivers queued completions and clears them', async () => {
    await enqueueProgress(entry(1));
    await enqueueProgress(entry(2));

    const result = await flushProgressQueue('token');

    assert.deepEqual(attempts.map((a) => a.day), [1, 2]);
    assert.equal(await pendingProgressCount(), 0);
    assert.equal(result?.currentDay, 3, 'returns the newest response so totals can converge');
  });

  it('retains an entry when the network fails, so nothing is lost', async () => {
    await enqueueProgress(entry(1));
    outcomes = ['network'];

    await flushProgressQueue('token');
    assert.equal(await pendingProgressCount(), 1, 'must survive for the next attempt');

    // Next launch: connectivity is back.
    await flushProgressQueue('token');
    assert.equal(await pendingProgressCount(), 0);
  });

  it('drops an entry the server will never accept', async () => {
    await enqueueProgress(entry(1));
    outcomes = ['gone']; // 404 — child deleted; retrying forever would wedge the queue

    await flushProgressQueue('token');
    assert.equal(await pendingProgressCount(), 0);
  });

  it('does not let one poisoned entry block the others', async () => {
    await enqueueProgress(entry(1));
    await enqueueProgress(entry(2));
    await enqueueProgress(entry(3));
    outcomes = ['gone', 'network', 'ok'];

    await flushProgressQueue('token');

    assert.deepEqual(attempts.map((a) => a.day), [1, 2, 3], 'every entry is attempted');
    assert.equal(await pendingProgressCount(), 1, 'only the transient failure is retained');
  });

  it('collapses a re-queued day instead of growing the backlog', async () => {
    await enqueueProgress(entry(5));
    await enqueueProgress(entry(5));
    await enqueueProgress(entry(5));
    assert.equal(await pendingProgressCount(), 1);
  });

  it('keeps distinct days separate', async () => {
    await enqueueProgress(entry(5));
    await enqueueProgress(entry(6));
    assert.equal(await pendingProgressCount(), 2);
  });

  it('survives corrupt storage rather than throwing', async () => {
    store.set('soz-progress-queue-v1', 'not json{');
    assert.equal(await pendingProgressCount(), 0);
    await enqueueProgress(entry(1));
    assert.equal(await pendingProgressCount(), 1);
  });
});
