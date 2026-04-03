CREATE TABLE IF NOT EXISTS wallet_age_cache (
  address TEXT PRIMARY KEY,
  wallet_age_days INTEGER NOT NULL,
  checked_at INTEGER NOT NULL
);
