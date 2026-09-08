/**
 * RevenueCat webhook → users.premium_until.
 *
 * RevenueCat owns the billing relationship with Apple/Google; this endpoint is
 * how the server learns about it. Without it the API has no idea who paid, which
 * is what let the client-only paywall be bypassed.
 *
 * Setup (RevenueCat dashboard → Integrations → Webhooks):
 *   URL:            https://<api-host>/billing/revenuecat
 *   Authorization:  the exact value of REVENUECAT_WEBHOOK_SECRET
 * The mobile app must call Purchases.logIn(userId) so RevenueCat's app_user_id
 * matches our users.id — otherwise events arrive for an account we can't resolve.
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

import { requireAuth } from '../auth/middleware.js';
import { isPremium } from '../auth/entitlement.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { users } from '../db/schema.js';

export const billingRoute = new Hono();

/** Events that mean "entitlement is active until expiration_at_ms". */
const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'PRODUCT_CHANGE',
]);

/** Events that revoke access immediately, regardless of the original expiry. */
const REVOKING = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED', 'TRANSFER']);

// NOTE: CANCELLATION is deliberately in NEITHER set — it means auto-renew was
// turned off, and the user keeps access until the period actually ends. Treating
// it as a revoke would cut off someone who has already paid for the month.

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
}

billingRoute.post('/revenuecat', async (c) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[billing] REVENUECAT_WEBHOOK_SECRET not set — rejecting webhook');
    return c.json({ error: 'not_configured' }, 503);
  }
  // RevenueCat sends the configured value verbatim in the Authorization header.
  if (c.req.header('Authorization') !== secret) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);

  let payload: { event?: RevenueCatEvent };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const event = payload.event;
  if (!event?.type) return c.json({ error: 'invalid_event' }, 400);

  // app_user_id is our users.id when the client called Purchases.logIn(userId).
  const appUserId = event.app_user_id ?? event.original_app_user_id;
  if (!appUserId) return c.json({ error: 'missing_app_user_id' }, 400);

  const db = getDb();

  // Resolve by our own id first, then by a previously linked RevenueCat id (which
  // covers anonymous RevenueCat ids that were later aliased to the account).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(isUuid ? eq(users.id, appUserId) : eq(users.revenuecatUserId, appUserId))
    .limit(1);

  if (!user) {
    // 200, not 404: RevenueCat retries non-2xx, and an event for an account we
    // don't have (deleted user, wrong environment) will never become deliverable.
    console.warn('[billing] event for unknown app_user_id', { type: event.type, appUserId });
    return c.json({ ok: true, ignored: 'unknown_user' });
  }

  let premiumUntil: Date | null | undefined;
  if (REVOKING.has(event.type)) {
    premiumUntil = null;
  } else if (GRANTING.has(event.type)) {
    premiumUntil = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  } else {
    // BILLING_ISSUE, CANCELLATION, TEST, … — nothing to change.
    return c.json({ ok: true, ignored: event.type });
  }

  await db
    .update(users)
    .set({ premiumUntil, revenuecatUserId: appUserId })
    .where(eq(users.id, user.id));

  console.log('[billing] entitlement updated', {
    userId: user.id,
    type: event.type,
    premiumUntil: premiumUntil?.toISOString() ?? null,
  });

  return c.json({ ok: true });
});

// GET /billing/status — what the SERVER thinks this account is entitled to.
// The client uses it to reconcile its local isPremium flag after a purchase or
// restore, so the two can't drift.
billingRoute.get('/status', requireAuth, async (c) => {
  const userId = c.get('userId');
  return c.json({ isPremium: await isPremium(userId) });
});
