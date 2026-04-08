-- Portfolio-aware agents — user opt-in setting
-- Wallet management already exists in watched_wallets table

CREATE TABLE IF NOT EXISTS portfolio_settings (
  address TEXT PRIMARY KEY,
  portfolio_context_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
