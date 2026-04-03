CREATE TABLE IF NOT EXISTS telegram_users (
  telegram_id TEXT PRIMARY KEY,
  telegram_username TEXT,
  wallet_address TEXT,
  daily_queries_used INTEGER NOT NULL DEFAULT 0,
  daily_reset_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tg_wallet
  ON telegram_users(wallet_address);
