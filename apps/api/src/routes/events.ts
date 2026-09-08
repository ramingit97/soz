import { Hono } from 'hono';

import { requireAuth } from '../auth/middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const eventsRoute = new Hono();

// Product analytics. First-party only — no third-party SDK touches the child
// context (App Store Kids category forbids it), which is why this exists at all
// instead of a vendor tag.
//
// Was open and unlimited: anyone could flood the API's stdout, and every event
// arrived unattributed. Requires a token now (the trial has one too) and is
// capped per user.
eventsRoute.use('*', requireAuth);
eventsRoute.use('*', rateLimit({ name: 'events', capacity: 300, windowMs: 60 * 60 * 1000 }));

eventsRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    // Attribute server-side: the client's own userId claim is not trusted.
    console.log('[analytics]', JSON.stringify({ ...body, userId: c.get('userId') }));
  } catch {
    // invalid body — ignore
  }
  return c.json({ ok: true });
});
