-- Migrate nonce store and rate limiter from in-memory to D1

-- Nonces: single-use, 5min TTL, used for SIWE session verification
CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

-- Rate limits: fixed-window counters keyed by prefix:identity
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
