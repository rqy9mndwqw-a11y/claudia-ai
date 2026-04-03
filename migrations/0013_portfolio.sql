-- Watched wallets for multi-wallet tracking
CREATE TABLE IF NOT EXISTS watched_wallets (
  id TEXT PRIMARY KEY,
  owner_address TEXT NOT NULL,
  watch_address TEXT NOT NULL,
  label TEXT,
  added_at INTEGER NOT NULL,
  UNIQUE(owner_address, watch_address)
);

CREATE INDEX IF NOT EXISTS idx_watched_wallets_owner
  ON watched_wallets(owner_address);

-- Portfolio snapshots for P&L tracking
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  total_value_usd REAL NOT NULL,
  token_count INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(address, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_address
  ON portfolio_snapshots(address, snapshot_date DESC);
