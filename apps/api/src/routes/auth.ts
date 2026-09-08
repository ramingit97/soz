import bcrypt from 'bcryptjs';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { signToken } from '../auth/jwt.js';
import { revokeSessions } from '../auth/tokenVersion.js';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { authCodes, children, conversations, users } from '../db/schema.js';
import { emailVerificationEmail, passwordResetEmail, sendEmail } from '../services/email.js';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueAuthCode(email: string, purpose: 'password_reset' | 'email_verify', ttlMinutes: number): Promise<string> {
  const db = getDb();
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  // Invalidate previous unused codes for the same purpose+email
  await db
    .update(authCodes)
    .set({ used: 1 })
    .where(and(eq(authCodes.email, email), eq(authCodes.purpose, purpose), eq(authCodes.used, 0)));
  await db.insert(authCodes).values({ email, purpose, codeHash, expiresAt, used: 0 });
  return code;
}

async function consumeAuthCode(email: string, purpose: 'password_reset' | 'email_verify', code: string): Promise<boolean> {
  const db = getDb();
  const candidates = await db
    .select()
    .from(authCodes)
    .where(
      and(
        eq(authCodes.email, email),
        eq(authCodes.purpose, purpose),
        eq(authCodes.used, 0),
        gt(authCodes.expiresAt, new Date()),
      ),
    );
  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      await db.update(authCodes).set({ used: 1 }).where(eq(authCodes.id, candidate.id));
      return true;
    }
  }
  return false;
}

export const authRoute = new Hono();

// Anti-brute-force: 10 login attempts per IP per 15 min, 5 registrations per hour
authRoute.use('/login', rateLimit({ name: 'login', capacity: 10, windowMs: 15 * 60 * 1000 }));
authRoute.use('/register', rateLimit({ name: 'register', capacity: 5, windowMs: 60 * 60 * 1000 }));

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const guestSchema = z.object({
  // Opaque per-install id. Issued BY the server on first call and echoed back by
  // the client to resume the same trial. It is a bearer secret — whoever holds it
  // gets that trial account — so it must be unguessable, which is why the client
  // never invents one (React Native has no crypto-strong RNG without an extra
  // native module).
  deviceId: z.string().min(8).max(128).optional(),
});

// POST /auth/guest — anonymous trial account.
//
// Every AI endpoint requires a token; without this a first-launch user could not
// try the app before signing up. So the trial gets a REAL user row (guest) and a
// real JWT: the server always knows who is calling, quotas and ownership checks
// apply uniformly, and registering later upgrades this row in place.
authRoute.use('/guest', rateLimit({ name: 'guest', capacity: 5, windowMs: 60 * 60 * 1000 }));
authRoute.post('/guest', zValidator('json', guestSchema), async (c) => {
  if (!isDbAvailable()) {
    return c.json({ error: 'database_not_configured' }, 503);
  }

  const { deviceId } = c.req.valid('json');
  const db = getDb();

  // Resume an existing trial for this device rather than forking a new one.
  if (deviceId) {
    const [existing] = await db
      .select({
        id: users.id,
        email: users.email,
        isGuest: users.isGuest,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    if (existing) {
      // The trial was already upgraded to a real account — the client must log in.
      if (existing.isGuest !== 1) return c.json({ error: 'device_already_registered' }, 409);
      const token = await signToken({
        userId: existing.id,
        email: existing.email,
        isGuest: true,
        tv: existing.tokenVersion,
      });
      return c.json({ token, deviceId, user: { id: existing.id, email: existing.email }, isGuest: true });
    }
    // Unknown id (cleared storage, restored backup) — fall through and issue a
    // fresh trial rather than trusting a client-supplied id we never handed out.
  }

  const newDeviceId = crypto.randomUUID();
  // Synthetic address: `users.email` is NOT NULL UNIQUE and a guest has no real
  // one. The .invalid TLD is reserved (RFC 2606) so this can never be delivered.
  const email = `guest-${crypto.randomUUID()}@guest.invalid`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, isGuest: 1, deviceId: newDeviceId })
    .returning({ id: users.id, email: users.email, tokenVersion: users.tokenVersion });

  if (!user) return c.json({ error: 'guest_failed' }, 500);

  const token = await signToken({
    userId: user.id,
    email: user.email,
    isGuest: true,
    tv: user.tokenVersion,
  });
  return c.json(
    { token, deviceId: newDeviceId, user: { id: user.id, email: user.email }, isGuest: true },
    201,
  );
});

// POST /auth/register
//
// optionalAuth: when called with a guest token the trial row is upgraded in place
// (same userId → children, progress and memory from day 1 survive sign-up) instead
// of creating a second account and orphaning the trial.
authRoute.post('/register', optionalAuth, zValidator('json', registerSchema), async (c) => {
  if (!isDbAvailable()) {
    return c.json({ error: 'database_not_configured' }, 503);
  }

  const { email, password } = c.req.valid('json');
  const db = getDb();

  // Check duplicate
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'email_taken' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Upgrade path — only for a caller presenting a valid guest token.
  const callerId = c.get('userId');
  if (callerId && c.get('isGuest')) {
    // deviceId is deliberately KEPT. Clearing it made the "device already
    // registered" branch in /auth/guest unreachable: a stale call with the old id
    // matched nothing and minted a brand-new guest account instead of telling the
    // client to log in. Retaining it also stops one device from farming repeat
    // trials. It grants nothing on its own — /auth/guest returns 409, not a token,
    // once the row is no longer a guest.
    const [upgraded] = await db
      .update(users)
      .set({ email, passwordHash, isGuest: 0 })
      .where(and(eq(users.id, callerId), eq(users.isGuest, 1)))
      .returning({ id: users.id, email: users.email, tokenVersion: users.tokenVersion });

    if (upgraded) {
      issueAuthCode(email, 'email_verify', 24 * 60)
        .then((code) => sendEmail({ to: email, ...emailVerificationEmail(code) }))
        .catch((e) => console.warn('[auth] verification email send failed:', e));

      const token = await signToken({
        userId: upgraded.id,
        email: upgraded.email,
        tv: upgraded.tokenVersion,
      });
      return c.json({ token, user: { id: upgraded.id, email: upgraded.email }, upgraded: true }, 200);
    }
    // Row vanished or was already upgraded — fall through to a fresh account.
  }

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      tokenVersion: users.tokenVersion,
    });

  if (!user) return c.json({ error: 'register_failed' }, 500);

  // Fire-and-forget verification email — don't block register flow
  issueAuthCode(email, 'email_verify', 24 * 60)
    .then((code) => sendEmail({ to: email, ...emailVerificationEmail(code) }))
    .catch((e) => console.warn('[auth] verification email send failed:', e));

  const token = await signToken({ userId: user.id, email: user.email, tv: user.tokenVersion });

  return c.json({ token, user: { id: user.id, email: user.email } }, 201);
});

// POST /auth/login
authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  if (!isDbAvailable()) {
    return c.json({ error: 'database_not_configured' }, 503);
  }

  const { email, password } = c.req.valid('json');
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const token = await signToken({ userId: user.id, email: user.email, tv: user.tokenVersion });

  return c.json({ token, user: { id: user.id, email: user.email } });
});

// GET /auth/me
authRoute.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const email = c.get('userEmail');
  if (!isDbAvailable()) return c.json({ userId, email });
  const db = getDb();
  const [u] = await db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return c.json({ userId, email, emailVerified: !!u?.emailVerified });
});

// DELETE /auth/account — full account erase (COPPA / GDPR / Google Play).
// Removes the user and ALL their children's data. children.userId cascades to
// lesson_progress / child_memory / memory_threads / curricula / generated_weeks,
// but conversations.childId is ON DELETE SET NULL — so we delete the transcripts
// for every child first (privacy promise), then delete the user row.
authRoute.delete('/account', requireAuth, async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const userId = c.get('userId');
  const db = getDb();

  const kids = await db
    .select({ id: children.id })
    .from(children)
    .where(eq(children.userId, userId));

  if (kids.length > 0) {
    await db.delete(conversations).where(
      inArray(conversations.childId, kids.map((k) => k.id)),
    );
  }

  // Deleting the user cascades through children → all per-child tables.
  await db.delete(users).where(eq(users.id, userId));

  return c.json({ ok: true, deletedChildren: kids.length });
});

// ── Password reset ───────────────────────────────────────────────────────────

const forgotSchema = z.object({ email: z.string().email().toLowerCase() });

authRoute.use('/forgot-password', rateLimit({ name: 'forgot', capacity: 5, windowMs: 60 * 60 * 1000 }));
authRoute.post('/forgot-password', zValidator('json', forgotSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ ok: true }); // Don't leak DB issues
  const { email } = c.req.valid('json');
  const db = getDb();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  // Always return ok — don't reveal which emails exist
  if (u) {
    const code = await issueAuthCode(email, 'password_reset', 15);
    const tpl = passwordResetEmail(code);
    await sendEmail({ to: email, ...tpl });
  }
  return c.json({ ok: true });
});

const resetSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(6).max(100),
});

authRoute.use('/reset-password', rateLimit({ name: 'reset', capacity: 10, windowMs: 60 * 60 * 1000 }));
authRoute.post('/reset-password', zValidator('json', resetSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const { email, code, newPassword } = c.req.valid('json');
  const ok = await consumeAuthCode(email, 'password_reset', code);
  if (!ok) return c.json({ error: 'invalid_or_expired_code' }, 400);
  const db = getDb();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const [updated] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email))
    .returning({ id: users.id });

  // The whole point of a reset is usually that someone else has the account.
  // Changing the password alone left their 30-day token working, so end every
  // existing session too.
  if (updated) await revokeSessions(updated.id);

  return c.json({ ok: true });
});

// ── Email verification ───────────────────────────────────────────────────────

authRoute.use('/send-verification', rateLimit({ name: 'send_verify', capacity: 5, windowMs: 60 * 60 * 1000 }));
authRoute.post('/send-verification', requireAuth, async (c) => {
  const email = c.get('userEmail');
  if (!isDbAvailable()) return c.json({ ok: true });
  const code = await issueAuthCode(email, 'email_verify', 24 * 60);
  const tpl = emailVerificationEmail(code);
  await sendEmail({ to: email, ...tpl });
  return c.json({ ok: true });
});

const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

authRoute.use('/verify-email', rateLimit({ name: 'verify', capacity: 10, windowMs: 60 * 60 * 1000 }));
authRoute.post('/verify-email', requireAuth, zValidator('json', verifySchema), async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const userId = c.get('userId');
  const email = c.get('userEmail');
  const { code } = c.req.valid('json');
  const ok = await consumeAuthCode(email, 'email_verify', code);
  if (!ok) return c.json({ error: 'invalid_or_expired_code' }, 400);
  const db = getDb();
  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, userId));
  return c.json({ ok: true });
});
