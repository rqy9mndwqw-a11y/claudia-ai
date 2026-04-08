/**
 * D1-backed nonce store for SIWE session verification.
 * Each nonce is valid for 5 minutes and single-use.
 * Persisted in D1 so nonces work across CF Worker isolates.
 */

import { getDB } from "./marketplace/db";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Store a nonce for later verification. */
export async function storeNonce(nonce: string): Promise<void> {
  const db = getDB();
  const now = Date.now();

  // Lazy cleanup: delete nonces older than 10 minutes
  await db.batch([
    db.prepare("DELETE FROM nonces WHERE created_at < ?").bind(now - CLEANUP_TTL_MS),
    db.prepare("INSERT OR IGNORE INTO nonces (nonce, created_at, used) VALUES (?, ?, 0)").bind(nonce, now),
  ]);
}

/**
 * Verify and consume a nonce. Returns true if the nonce exists,
 * hasn't been used, and hasn't expired. Marks as used atomically.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const db = getDB();
  const now = Date.now();
  const minCreatedAt = now - NONCE_TTL_MS;

  // Atomic: mark as used only if it exists, is unused, and within TTL
  const result = await db.prepare(
    "UPDATE nonces SET used = 1 WHERE nonce = ? AND used = 0 AND created_at >= ?"
  ).bind(nonce, minCreatedAt).run();

  return (result.meta?.changes ?? 0) > 0;
}
