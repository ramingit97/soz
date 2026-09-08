import type { Context, Next } from 'hono';

/**
 * Simple in-memory token-bucket rate limiter. Keyed by IP or userId.
 * Good for single-instance deployments. Swap for Redis-based limiter
 * (e.g. @upstash/ratelimit) when scaling beyond one server.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// Cleanup stale buckets every 5 minutes to avoid unbounded growth
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [key, b] of buckets.entries()) {
    if (b.lastRefill < cutoff) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  capacity: number;
  /** Window in milliseconds */
  windowMs: number;
  /** Optional name (used in error message) */
  name?: string;
  /** Optional key extractor; defaults to userId-or-IP */
  keyOf?: (c: Context) => string;
  /**
   * Per-request capacity override — lets one limiter serve both tiers, e.g. a
   * small daily allowance for free accounts and a loose abuse ceiling for
   * subscribers ("Лимит" vs "∞" on the paywall). Falls back to `capacity`.
   */
  capacityOf?: (c: Context) => Promise<number> | number;
}

function defaultKey(c: Context): string {
  // Prefer authenticated userId for accurate per-user limits
  try {
    const uid = c.get('userId');
    if (uid) return `u:${uid}`;
  } catch {
    /* userId not set — falls through to IP */
  }
  // Fallback to IP — handles common proxy headers
  const xff = c.req.header('x-forwarded-for');
  const ip = xff?.split(',')[0]?.trim()
    ?? c.req.header('cf-connecting-ip')
    ?? c.req.header('x-real-ip')
    ?? 'unknown';
  return `ip:${ip}`;
}

export function rateLimit(opts: RateLimitOptions) {
  const { capacity: baseCapacity, windowMs, name = 'default', keyOf = defaultKey, capacityOf } = opts;

  return async (c: Context, next: Next) => {
    const capacity = capacityOf ? await capacityOf(c) : baseCapacity;
    // Recomputed per request because capacity can differ by tier.
    const refillRate = capacity / windowMs; // tokens per ms
    // Tier is part of the key: without it, upgrading mid-window would inherit the
    // free tier's drained bucket and a subscriber would stay throttled.
    const key = `${name}:${capacity}:${keyOf(c)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity - 1, lastRefill: now };
      buckets.set(key, bucket);
      return next();
    }

    // Refill since last touch
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const retrySec = Math.ceil((1 - bucket.tokens) / refillRate / 1000);
      c.header('Retry-After', String(retrySec));
      c.header('X-RateLimit-Limit', String(capacity));
      c.header('X-RateLimit-Remaining', '0');
      return c.json(
        { error: 'rate_limit_exceeded', name, retryAfterSec: retrySec },
        429,
      );
    }

    bucket.tokens -= 1;
    c.header('X-RateLimit-Limit', String(capacity));
    c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
    return next();
  };
}

/**
 * Read a bucket without consuming from it — for a "12 of 30 left today" line in
 * the parent UI. Mirrors the refill maths above exactly; a bucket that was never
 * touched reports full capacity.
 */
export function peekRateLimit(opts: {
  name: string;
  capacity: number;
  windowMs: number;
  key: string;
}): { limit: number; remaining: number } {
  const { name, capacity, windowMs, key } = opts;
  const bucket = buckets.get(`${name}:${capacity}:${key}`);
  if (!bucket) return { limit: capacity, remaining: capacity };
  const refillRate = capacity / windowMs;
  const tokens = Math.min(capacity, bucket.tokens + (Date.now() - bucket.lastRefill) * refillRate);
  return { limit: capacity, remaining: Math.max(0, Math.floor(tokens)) };
}
