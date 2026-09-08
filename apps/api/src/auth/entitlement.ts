/**
 * Server-side entitlement.
 *
 * The app already had a paywall, but it lived entirely in the client: `isPremium`
 * in a zustand store persisted to AsyncStorage, editable on a rooted device, and
 * the API had no concept of a subscription at all. So the paywall gated the UI
 * while the expensive endpoints stayed free to anyone who skipped it.
 *
 * RevenueCat remains the source of truth for billing; it pushes entitlement
 * changes to /billing/revenuecat, which writes `users.premium_until`. Everything
 * that costs real money reads it from here.
 */

import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * Course days 1..FREE_DAYS are usable without a subscription. Mirrors
 * FREE_DAYS in apps/mobile/src/services/subscriptions.ts — keep the two in step.
 */
export const FREE_DAYS = 7;

export async function isPremium(userId: string): Promise<boolean> {
  if (!isDbAvailable()) return false;
  try {
    const [row] = await getDb()
      .select({ premiumUntil: users.premiumUntil })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return !!row?.premiumUntil && row.premiumUntil.getTime() > Date.now();
  } catch {
    // A DB blip must not hand out free premium.
    return false;
  }
}

/**
 * Blocks the request unless the caller has an active subscription.
 * Use on endpoints that are premium-only regardless of day.
 */
export async function requirePremium(c: Context, next: Next) {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  if (await isPremium(userId)) return next();
  return c.json({ error: 'premium_required' }, 402);
}

/**
 * Guard for day-gated content: free through FREE_DAYS, subscription beyond.
 *
 *   const denied = await requirePaidDay(c, day);
 *   if (denied) return denied;
 */
export async function requirePaidDay(c: Context, day: number) {
  if (day <= FREE_DAYS) return null;
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);
  if (await isPremium(userId)) return null;
  return c.json({ error: 'premium_required', freeDays: FREE_DAYS }, 402);
}
