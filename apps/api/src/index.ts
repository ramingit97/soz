import 'dotenv/config';

// Initialize Sentry FIRST — before importing the app — so it instruments everything.
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false, // we're a kids app — never send PII
  });
  console.log('[sentry] error monitoring enabled');
}

import { serve } from '@hono/node-server';
import { app } from './app.js';

// Critical env validation — fail fast if production is misconfigured.
//
// RESEND_API_KEY is required in production because services/email.ts falls back
// to printing the message to stdout and returning ok:true. Without the key,
// password reset and email verification appear to succeed and silently deliver
// nothing — the parent taps "forgot password" and never gets a code.
//
// REVENUECAT_WEBHOOK_SECRET is required because it is the only thing that writes
// users.premium_until; unset, nobody's subscription is ever recorded and every
// paying customer keeps hitting the paywall.
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'DEEPGRAM_API_KEY',
  'RESEND_API_KEY',
  'REVENUECAT_WEBHOOK_SECRET',
  // Every crisis alert is copied here. Required by decision (2026-08-25): a
  // crisis must always reach a human on our side, not only the parent.
  'SAFETY_OPERATOR_EMAIL',
];
const isProd = process.env.NODE_ENV === 'production';
const missing = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k]?.trim() === '');

if (missing.length > 0) {
  if (isProd) {
    console.error(`[fatal] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    console.warn(`[warn] Missing env vars (dev mode, continuing): ${missing.join(', ')}`);
  }
}

if (isProd && process.env.JWT_SECRET === 'change-me-in-production') {
  console.error('[fatal] JWT_SECRET must be changed from default in production');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`🤖 Söz API listening on http://0.0.0.0:${info.port}`);
});

// Transcript retention (privacy policy: 90 days). Daily, plus once after boot.
import('./services/retention.js')
  .then((m) => m.startRetentionJob())
  .catch((e) => console.error('[retention] failed to start:', e));

// Graceful shutdown — drain the DB pool instead of severing in-flight queries.
// Fly restarts and deploys send SIGTERM routinely, so this runs often.
let shuttingDown = false;
const shutdown = async (sig: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${sig}] shutting down...`);
  try {
    const { closeDb } = await import('./db/client.js');
    await closeDb();
  } catch (e) {
    console.warn('[shutdown] closing db failed:', e);
  }
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
