/**
 * Session revocation.
 *
 * Tokens are HS256 bearer tokens valid for 30 days and the server keeps no
 * session table, so until now nothing could end a session early. That made
 * password reset largely theatre: the parent resets because someone else got
 * into the account, and that someone's token keeps working for up to a month.
 *
 * `users.token_version` is the fix. It is stamped into every token as `tv`, and a
 * mismatch means the token predates the last revocation.
 *
 * The cost is a lookup on every authenticated request, which is why the value is
 * cached for a minute. That makes revocation eventual rather than instant across
 * machines — acceptable, and honest: with `min_machines_running = 1` the bump and
 * the cache live in the same process, so today it IS instant.
 */

import { eq, sql } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { users } from '../db/schema.js';

const CACHE_TTL_MS = 60_000;
/** Bounded so a flood of distinct tokens cannot grow this without limit. */
const MAX_ENTRIES = 10_000;

const cache = new Map<string, { version: number; expiresAt: number }>();

function readCache(userId: string): number | null {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(userId);
    return null;
  }
  return hit.version;
}

function writeCache(userId: string, version: number): void {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(userId, { version, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Is this token from the current session generation?
 *
 * Fails OPEN on a database error: the signature has already been verified, so the
 * caller is who they claim to be. Rejecting everyone because the database blinked
 * would turn a transient outage into a total logout.
 */
export async function isTokenCurrent(userId: string, tv: number | undefined): Promise<boolean> {
  if (!isDbAvailable()) return true;

  const presented = tv ?? 0;

  const cached = readCache(userId);
  if (cached !== null) return presented === cached;

  try {
    const [row] = await getDb()
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // No row: the account was deleted. The token is signed and unexpired, so
    // without this check it would keep opening doors on a dead account.
    if (!row) return false;

    writeCache(userId, row.tokenVersion);
    return presented === row.tokenVersion;
  } catch (e) {
    console.warn('[auth] token version lookup failed, allowing request:', e);
    return true;
  }
}

/** Invalidate every existing session for this user. Returns the new version. */
export async function revokeSessions(userId: string): Promise<number> {
  const [row] = await getDb()
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ tokenVersion: users.tokenVersion });

  const version = row?.tokenVersion ?? 0;
  writeCache(userId, version);
  return version;
}

/** Test seam — the cache is process-local and otherwise invisible. */
export function clearTokenVersionCache(): void {
  cache.clear();
}
