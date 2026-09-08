import type { Context, Next } from 'hono';

import { verifyToken } from './jwt.js';
import { isTokenCurrent } from './tokenVersion.js';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
    isGuest: boolean;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  // Only the verification is guarded. next() used to sit inside this try, so any
  // error thrown by a downstream handler came back as 401 token_invalid — a real
  // 500 disguised as an auth failure, never reaching app.onError or Sentry.
  let payload;
  try {
    payload = await verifyToken(auth.slice(7));
  } catch {
    return c.json({ error: 'token_invalid' }, 401);
  }

  if (!(await isTokenCurrent(payload.userId, payload.tv))) {
    return c.json({ error: 'token_revoked' }, 401);
  }

  c.set('userId', payload.userId);
  c.set('userEmail', payload.email);
  c.set('isGuest', payload.isGuest === true);
  await next();
}

/**
 * Reads the bearer token WITHOUT requiring one. For endpoints that behave
 * differently for a signed-in caller but must still serve anonymous ones
 * (e.g. /auth/register upgrading a guest row in place).
 */
export async function optionalAuth(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = await verifyToken(auth.slice(7));
      // A revoked token is treated exactly like an invalid one here: proceed as
      // anonymous, which is what this middleware exists to allow. Note that
      // next() is deliberately NOT called inside the try — an error thrown by a
      // downstream handler would be swallowed as "bad token" and the chain would
      // run a second time.
      if (await isTokenCurrent(payload.userId, payload.tv)) {
        c.set('userId', payload.userId);
        c.set('userEmail', payload.email);
        c.set('isGuest', payload.isGuest === true);
      }
    } catch {
      /* invalid token on an optional-auth route — proceed as anonymous */
    }
  }
  await next();
}
