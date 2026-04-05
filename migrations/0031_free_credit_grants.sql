CREATE TABLE free_credit_grants (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  credits_remaining INTEGER DEFAULT 10,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_free_credits_wallet ON free_credit_grants(wallet_address);
