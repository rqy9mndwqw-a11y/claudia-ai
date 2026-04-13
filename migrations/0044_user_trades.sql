-- User-executed DEX trades originated from "Act on Signal" flow.
-- Written by POST /api/trading/record AFTER the client broadcasts.
--
-- Invariants:
--   - wallet_address is always lowercase (server-normalized)
--   - tx_hash is always lowercase, UNIQUE to prevent double-logging
--   - venue is always 'dex_0x_base' today (Kraken execution not supported)
--   - signal_id is nullable — not every trade originates from a signal

CREATE TABLE IF NOT EXISTS user_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,    -- lowercase ERC-20 address
  token_symbol TEXT NOT NULL,
  venue TEXT NOT NULL,            -- 'dex_0x_base' (only value today)
  spend_usdc REAL NOT NULL,
  tokens_received REAL NOT NULL,
  effective_price REAL NOT NULL,  -- spend_usdc / tokens_received
  price_impact_pct REAL,
  gas_usd REAL,
  tx_hash TEXT NOT NULL UNIQUE,   -- UNIQUE: idempotency for duplicate POSTs
  signal_id TEXT,                 -- FK-ish to scanner_alerts.id; TEXT, not enforced
  source_page TEXT,               -- 'scanner' | 'full-analysis' | 'compare' | 'watchlist' | 'direct'
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_trades_wallet
  ON user_trades(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_trades_token
  ON user_trades(token_address);
CREATE INDEX IF NOT EXISTS idx_user_trades_signal
  ON user_trades(signal_id);
