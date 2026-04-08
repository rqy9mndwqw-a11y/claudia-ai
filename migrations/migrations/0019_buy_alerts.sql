-- Buy alert tracking — logs every CLAUDIA buy on Aerodrome pool
-- Used by telegram-bot webhook to post alerts to group chat

CREATE TABLE IF NOT EXISTS buy_alerts (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  usd_value REAL NOT NULL,
  claudia_amount TEXT NOT NULL,
  weth_amount TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  posted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buy_alerts_created ON buy_alerts(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buy_alerts_tx ON buy_alerts(tx_hash);
