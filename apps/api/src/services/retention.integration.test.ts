/**
 * The retention purge, against a REAL database — the WHERE clause is the whole
 * feature, and a mocked delete would pass with any predicate.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';

import { closeDb, getDb, isDbAvailable } from '../db/client.js';
import { conversations } from '../db/schema.js';

import { purgeOldConversations } from './retention.js';

const hasDb = isDbAvailable();

describe('transcript retention', { skip: hasDb ? false : 'DATABASE_URL not set' }, () => {
  const stamp = Date.now();
  const oldId = `test-retention-old-${stamp}`;
  const edgeId = `test-retention-edge-${stamp}`;
  const freshId = `test-retention-fresh-${stamp}`;
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  before(async () => {
    await getDb()
      .insert(conversations)
      .values([
        {
          id: oldId,
          language: 'en',
          turns: [{ role: 'child', text: 'old' }],
          updatedAt: daysAgo(91),
        },
        { id: edgeId, language: 'en', turns: [], updatedAt: daysAgo(89) },
        { id: freshId, language: 'ru', turns: [], updatedAt: daysAgo(1) },
      ]);
  });

  after(async () => {
    await getDb()
      .delete(conversations)
      .where(inArray(conversations.id, [oldId, edgeId, freshId]));
    await closeDb();
  });

  it('deletes transcripts older than the window and keeps the rest', async () => {
    const purged = await purgeOldConversations(90, now);
    assert.ok(purged >= 1, 'at least our 91-day row went');

    const ids = (
      await getDb()
        .select({ id: conversations.id })
        .from(conversations)
        .where(inArray(conversations.id, [oldId, edgeId, freshId]))
    ).map((r) => r.id);

    assert.ok(!ids.includes(oldId), '91 days old → deleted');
    assert.ok(ids.includes(edgeId), '89 days old → kept');
    assert.ok(ids.includes(freshId), 'yesterday → kept');
  });

  it('is idempotent', async () => {
    const again = await purgeOldConversations(90, now);
    const [edge] = await getDb().select().from(conversations).where(eq(conversations.id, edgeId));
    assert.ok(edge, 'a second run does not creep past the cutoff');
    assert.equal(typeof again, 'number');
  });
});
