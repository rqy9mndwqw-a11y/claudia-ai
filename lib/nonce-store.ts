/**
 * Short-lived nonce store for SIWE session verification.
 * Each nonce is valid for 5 minutes and single-use.
 * On CF Workers this lives in the isolate's memory —
 * nonces naturally expire when the isolate recycles.
 */

interface NonceEntry {
  createdAt: number;
}

const NONCE_TTL = 5 * 60 * 1000; // 5 minutes
const store: Map<string, NonceEntry> = new Map();

/** Store a nonce for later verification. */
export function storeNonce(nonce: string): void {
  // Lazy cleanup: remove expired nonces on write
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > NONCE_TTL) {
      store.delete(key);
    }
  }

  store.set(nonce, { createdAt: now });
}

/**
 * Verify and consume a nonce. Returns true if the nonce exists
 * and hasn't expired. Deletes it after use (single-use).
 */
export function consumeNonce(nonce: string): boolean {
  const entry = store.get(nonce);
  if (!entry) return false;

  // Always delete — consumed or expired, it's done
  store.delete(nonce);

  if (Date.now() - entry.createdAt > NONCE_TTL) {
    return false;
  }

  return true;
}
