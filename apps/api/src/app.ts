import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { aiToolsRoute } from './routes/ai-tools.js';
import { analysisRoute } from './routes/analysis.js';
import { authRoute } from './routes/auth.js';
import { billingRoute } from './routes/billing.js';
import { childrenRoute } from './routes/children.js';
import { eventsRoute } from './routes/events.js';
import { healthRoute } from './routes/health.js';
import { lessonRoute } from './routes/lesson.js';
import { listeningRoute } from './routes/listening.js';
import { photoLearnRoute } from './routes/photo-learn.js';
import { progressRoute } from './routes/progress.js';
import { songRoute } from './routes/song.js';
import { talkRoute } from './routes/talk.js';

export const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.route('/health', healthRoute);
app.route('/ai', aiToolsRoute);
app.route('/auth', authRoute);
app.route('/billing', billingRoute);
app.route('/children', childrenRoute);
app.route('/progress', progressRoute);
app.route('/lessons', lessonRoute); // client calls /lessons/* (curriculum, generated, generate-week)
app.route('/talk', talkRoute);
app.route('/listening', listeningRoute);
app.route('/events', eventsRoute);
app.route('/analysis', analysisRoute);
app.route('/photo-learn', photoLearnRoute);
app.route('/song', songRoute);

app.get('/', (c) => c.json({ name: 'Söz API', status: 'ok' }));

app.onError(async (err, c) => {
  console.error('[error]', err);
  // Forward to Sentry if configured (lazy import — Sentry may not be initialized)
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/node');
      Sentry.captureException(err, {
        tags: { route: c.req.path, method: c.req.method },
      });
    } catch {
      /* sentry import failed — non-fatal */
    }
  }
  // Never echo err.message to the client in production. A failed Drizzle query
  // stringifies to the full SQL plus its bound parameters — a real 500 handed
  // the caller a statement and two account UUIDs. The detail is in the log and
  // in Sentry; the client gets a generic failure.
  const isProd = process.env.NODE_ENV === 'production';
  return c.json({ error: isProd ? 'internal_error' : err.message }, 500);
});
