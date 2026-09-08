/**
 * POST /progress against a REAL database.
 *
 * These rules are not expressible as pure functions — they are the interaction
 * between a unique constraint, a RETURNING clause and an UPDATE, and that
 * interaction is exactly where the bugs were: the insert was idempotent while
 * the totals update was not, so replaying a completion farmed stars, and
 * `currentDay = day + 1` walked a child BACKWARDS when they replayed an early
 * day. A unit test with a mocked db would have happily passed on the old code.
 *
 * Requires DATABASE_URL (the dev Neon branch is fine — it only creates rows it
 * then deletes). Skipped automatically when unset, so `pnpm test` stays green on
 * a machine with no database.
 *
 *   pnpm --filter @soz/api test
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { app } from '../app.js';
import { signToken } from '../auth/jwt.js';
import { closeDb, getDb, isDbAvailable } from '../db/client.js';
import { children, users } from '../db/schema.js';

const hasDb = isDbAvailable();

describe('POST /progress', { skip: hasDb ? false : 'DATABASE_URL not set' }, () => {
  let token: string;
  let userId: string;
  let childId: string;

  const post = (body: Record<string, unknown>) =>
    app.request('/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const complete = async (day: number, stars = 10) => {
    const res = await post({ childId, language: 'en', day, starsEarned: stars, tzOffsetMinutes: 240 });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  before(async () => {
    const db = getDb();
    const stamp = Date.now();
    const [u] = await db
      .insert(users)
      .values({ email: `test-progress-${stamp}@guest.invalid`, passwordHash: 'x', isGuest: 1 })
      .returning({ id: users.id, email: users.email });
    userId = u!.id;
    token = await signToken({ userId, email: u!.email });

    const [kid] = await db
      .insert(children)
      .values({ userId, name: 'Test', age: 8, learningLanguages: ['en'] })
      .returning({ id: children.id });
    childId = kid!.id;
  });

  after(async () => {
    // children/progress cascade from the user row.
    if (userId) await getDb().delete(users).where(eq(users.id, userId));
    // postgres-js holds the event loop open; without this the run never exits.
    await closeDb();
  });

  it('records the first completion and advances the day', async () => {
    const { status, body } = await complete(1);
    assert.equal(status, 200);
    assert.equal(body.totalStars, 10);
    assert.equal(body.streak, 1);
    assert.equal(body.currentDay, 2);
    assert.ok(!body.duplicate);
  });

  it('is idempotent — replaying a day awards nothing further', async () => {
    const { body } = await complete(1);
    assert.equal(body.duplicate, true);
    assert.equal(body.totalStars, 10, 'stars must not accrue on replay');
    assert.equal(body.currentDay, 2, 'day must not advance on replay');
  });

  it('never walks the child backwards when an earlier day is replayed', async () => {
    await complete(2);
    await complete(3); // currentDay is now 4
    const { body } = await complete(1); // replay day 1
    assert.equal(body.currentDay, 4, 'replaying day 1 must not reset currentDay to 2');
  });

  it('keeps the streak on a second lesson the same day', async () => {
    const { body } = await complete(4);
    assert.equal(body.streak, 1, 'same-day practice must not reset or double-count the chain');
  });

  it('rejects a childId belonging to someone else', async () => {
    const db = getDb();
    const [other] = await db
      .insert(users)
      .values({ email: `test-other-${Date.now()}@guest.invalid`, passwordHash: 'x', isGuest: 1 })
      .returning({ id: users.id, email: users.email });
    const [otherKid] = await db
      .insert(children)
      .values({ userId: other!.id, name: 'Other', age: 8, learningLanguages: ['en'] })
      .returning({ id: children.id });

    const res = await post({
      childId: otherKid!.id,
      language: 'en',
      day: 1,
      starsEarned: 50,
      tzOffsetMinutes: 240,
    });
    assert.equal(res.status, 404, 'must not accept progress for a child the caller does not own');

    await db.delete(users).where(eq(users.id, other!.id));
  });

  it('requires a token', async () => {
    const res = await app.request('/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, language: 'en', day: 1, starsEarned: 1 }),
    });
    assert.equal(res.status, 401);
  });
});
