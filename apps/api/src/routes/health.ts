import { sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { getDb, isDbAvailable } from '../db/client.js';

export const healthRoute = new Hono();

// Liveness — server is up
healthRoute.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'soz-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  }),
);

// Readiness — server can actually serve traffic (DB reachable)
healthRoute.get('/ready', async (c) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // DB check
  if (isDbAvailable()) {
    const start = Date.now();
    try {
      await getDb().execute(sql`SELECT 1`);
      checks.db = { ok: true, latencyMs: Date.now() - start };
    } catch (e) {
      // /health/ready is publicly reachable (Fly's checker calls it), and a
      // postgres connection error stringifies to something like
      // "getaddrinfo ENOTFOUND ep-xxx.eu-central-1.aws.neon.tech" — the database
      // host, handed to anyone who curls it. Log the detail, publish a label.
      console.error('[health] db check failed:', e);
      checks.db = {
        ok: false,
        error: process.env.NODE_ENV === 'production' ? 'unreachable' : String(e),
      };
    }
  } else {
    checks.db = { ok: false, error: 'DATABASE_URL not configured' };
  }

  // Env check
  const requiredEnv = ['OPENAI_API_KEY', 'DEEPGRAM_API_KEY', 'JWT_SECRET'];
  const missingEnv = requiredEnv.filter((k) => !process.env[k]);
  checks.env = {
    ok: missingEnv.length === 0,
    error: missingEnv.length ? `missing: ${missingEnv.join(', ')}` : undefined,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  return c.json({ status: allOk ? 'ready' : 'not_ready', checks }, allOk ? 200 : 503);
});
