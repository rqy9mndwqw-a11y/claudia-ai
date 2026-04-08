/**
 * D1-backed rate limiter (works across CF Worker isolates).
 * Uses fixed-window counters stored in the rate_limits table.
 */

import { getDB } from "./marketplace/db";

const CLEANUP_AGE_MS = 5 * 60 * 1000; // Clean up windows older than 5 minutes

/**
 * Check rate limit for a given key (typically "prefix:ip" or "prefix:address").
 */
export async function checkRateLimit(
  key: string,
  maxRequests = 20,
  windowMs = 60_000
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const db = getDB();
  const now = Date.now();
  const windowStart = now - (now % windowMs); // Align to fixed window boundary
  const resetAt = windowStart + windowMs;

  // Upsert: increment count for this window, or insert with count=1
  // Then read the count back (avoids RETURNING which is unreliable in some D1 versions)
  await db.batch([
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - CLEANUP_AGE_MS),
    db.prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1`
    ).bind(key, windowStart),
  ]);

  const row = await db.prepare(
    "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?"
  ).bind(key, windowStart).first<{ count: number }>();

  const count = row?.count ?? 1;
  const remaining = Math.max(0, maxRequests - count);
  const allowed = count <= maxRequests;

  return { allowed, remaining, resetAt };
}
