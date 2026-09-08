/**
 * Child-ownership guard.
 *
 * Every endpoint that takes a `childId` from the client must prove that child
 * belongs to the authenticated caller — otherwise the UUID itself becomes the
 * only access control, which is not access control. This lived inline in four
 * copies inside routes/talk.ts and was missing entirely from routes/progress.ts;
 * one implementation means one place to get it right.
 *
 * Use AFTER requireAuth — it reads `userId` off the context.
 */

import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { children, memoryThreads } from '../db/schema.js';

/**
 * True when `childId` belongs to the caller.
 *
 * With no DB configured there is nothing to own and nothing to leak, so this
 * returns true and lets the caller's own `isDbAvailable()` branch decide what to
 * serve (the routes already degrade to empty results in that mode).
 */
export async function ownsChild(userId: string, childId: string): Promise<boolean> {
  if (!isDbAvailable()) return true;
  // A non-UUID childId would make Postgres throw on the uuid comparison rather
  // than return no rows — treat it as "not yours" instead of a 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId)) {
    return false;
  }
  const [row] = await getDb()
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  return !!row;
}

/**
 * Guard for use inside a handler:
 *
 *   const denied = await requireChild(c, childId);
 *   if (denied) return denied;
 *
 * Returns a 404 response when the child isn't the caller's — 404 rather than 403
 * so the endpoint doesn't confirm that some other user's childId exists.
 */
export async function requireChild(c: Context, childId: string) {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  if (await ownsChild(userId, childId)) return null;
  return c.json({ error: 'child_not_found' }, 404);
}

/**
 * Same guard for a memory thread, resolved through the child that owns it.
 * Threads are addressed by their own id, so without this any authenticated
 * caller could mutate another child's memory by thread id alone.
 */
export async function requireThread(c: Context, threadId: string) {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  if (!isDbAvailable()) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId)) {
    return c.json({ error: 'not_found' }, 404);
  }
  const [row] = await getDb()
    .select({ id: memoryThreads.id })
    .from(memoryThreads)
    .innerJoin(children, eq(memoryThreads.childId, children.id))
    .where(and(eq(memoryThreads.id, threadId), eq(children.userId, userId)))
    .limit(1);
  return row ? null : c.json({ error: 'not_found' }, 404);
}
