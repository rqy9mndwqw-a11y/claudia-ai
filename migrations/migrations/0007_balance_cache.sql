-- Cache token balance checks to avoid 19s RPC retry on every request
CREATE TABLE IF NOT EXISTS balance_cache (
  address TEXT PRIMARY KEY,
  balance TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);
