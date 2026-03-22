/**
 * Simple in-memory rate limiter (edge-compatible).
 * Uses a plain object instead of Map, no setInterval.
 * For production at scale, swap for @upstash/ratelimit with Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store: Record<string, RateLimitEntry> = {};

/**
 * Check rate limit for a given key (typically IP address).
 */
export function checkRateLimit(
  key: string,
  maxRequests = 20,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store[key];

  // Lazy cleanup: remove stale entry on access
  if (entry && now > entry.resetAt) {
    delete store[key];
  }

  if (!store[key]) {
    store[key] = { count: 1, resetAt: now + windowMs };
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  store[key].count++;
  const remaining = Math.max(0, maxRequests - store[key].count);
  const allowed = store[key].count <= maxRequests;

  return { allowed, remaining, resetAt: store[key].resetAt };
}
