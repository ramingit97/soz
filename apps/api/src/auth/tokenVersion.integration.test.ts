/**
 * Session revocation, against a REAL database.
 *
 * A 30-day bearer token with no server-side session table cannot be taken back,
 * which made password reset mostly decorative: the parent resets precisely
 * because someone else is in the account, and that someone's token kept working
 * for the rest of the month. What is tested here is the whole loop — column,
 * `tv` claim, per-request check and its cache — because each piece is individually
 * trivial and it is their interaction that either revokes the session or does not.
 *
 * Requires DATABASE_URL. Skipped automatically when unset.
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { app } from '../app.js';
import { closeDb, getDb, isDbAvailable } from '../db/client.js';
import { users } from '../db/schema.js';

import { signToken } from './jwt.js';
import { clearTokenVersionCache, isTokenCurrent, revokeSessions } from './tokenVersion.js';

const hasDb = isDbAvailable();

describe('session revocation', { skip: hasDb ? false : 'DATABASE_URL not set' }, () => {
  const stamp = Date.now();
  const email = `test-revoke-${stamp}@example.com`;
  let userId: string;

  const me = (token: string) =>
    app.request('/auth/me', { headers: { Authorization: `Bearer ${token}` } });

  before(async () => {
    const [u] = await getDb()
      .insert(users)
      .values({ email, passwordHash: 'x' })
      .returning({ id: users.id });
    userId = u!.id;
  });

  after(async () => {
    await getDb().delete(users).where(eq(users.id, userId));
    await closeDb();
  });

  beforeEach(() => clearTokenVersionCache());

  it('accepts a token stamped with the current version', async () => {
    const token = await signToken({ userId, email, tv: 0 });
    assert.equal((await me(token)).status, 200);
  });

  it('accepts a legacy token with no tv claim at all', async () => {
    // Everyone signed in on the day this shipped holds one of these. Rejecting
    // them would log out the entire user base to fix a problem they do not have.
    const token = await signToken({ userId, email });
    assert.equal((await me(token)).status, 200);
  });

  it('rejects every existing token once sessions are revoked', async () => {
    const legacy = await signToken({ userId, email });
    const current = await signToken({ userId, email, tv: 0 });

    const version = await revokeSessions(userId);
    assert.equal(version, 1);
    clearTokenVersionCache();

    assert.equal((await me(legacy)).status, 401, 'the intruder token stops working');
    assert.equal((await me(current)).status, 401);

    const body = (await (await me(current)).json()) as { error: string };
    assert.equal(body.error, 'token_revoked', 'distinguishable from a malformed token');
  });

  it('issues a working token at the new version', async () => {
    const fresh = await signToken({ userId, email, tv: 1 });
    assert.equal((await me(fresh)).status, 200, 'the parent can sign back in');
  });

  it('rejects a signed token for an account that no longer exists', async () => {
    const ghost = await signToken({
      userId: '00000000-0000-4000-8000-000000000000',
      email: 'ghost@example.com',
      tv: 0,
    });
    assert.equal(await isTokenCurrent('00000000-0000-4000-8000-000000000000', 0), false);
    assert.equal((await me(ghost)).status, 401);
  });

  it('resolves repeat checks from cache instead of the database', async () => {
    clearTokenVersionCache();
    assert.equal(await isTokenCurrent(userId, 1), true); // populates
    await getDb().update(users).set({ tokenVersion: 99 }).where(eq(users.id, userId));

    assert.equal(await isTokenCurrent(userId, 1), true, 'still served from cache');
    clearTokenVersionCache();
    assert.equal(await isTokenCurrent(userId, 1), false, 'picked up after expiry');

    await getDb().update(users).set({ tokenVersion: 1 }).where(eq(users.id, userId));
  });
});
