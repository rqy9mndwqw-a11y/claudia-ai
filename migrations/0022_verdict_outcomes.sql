-- Verdict Outcome Tracking
-- Stores prediction snapshots from full analyses, then grades them at 24h/72h/7d.

CREATE TABLE IF NOT EXISTS verdict_outcomes (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  user_address TEXT NOT NULL,

  -- Prediction snapshot
  token_symbol TEXT NOT NULL,
  token_ca TEXT,
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  risk TEXT NOT NULL,
  price_at_verdict REAL NOT NULL,
  verdict_at INTEGER NOT NULL,

  -- 24h outcome
  price_24h REAL,
  change_24h REAL,
  grade_24h TEXT,
  points_24h INTEGER,
  checked_24h INTEGER DEFAULT 0,

  -- 72h outcome
  price_72h REAL,
  change_72h REAL,
  grade_72h TEXT,
  points_72h INTEGER,
  checked_72h INTEGER DEFAULT 0,

  -- 7d outcome
  price_7d REAL,
  change_7d REAL,
  grade_7d TEXT,
  points_7d INTEGER,
  checked_7d INTEGER DEFAULT 0,

  -- Composite (set after 7d check)
  total_points INTEGER,
  final_grade TEXT,

  -- Market context at verdict time
  btc_price_at_verdict REAL,
  btc_change_24h_at_verdict REAL,
  market_regime TEXT
);

CREATE INDEX IF NOT EXISTS idx_vo_checked
  ON verdict_outcomes (checked_24h, checked_72h, checked_7d, verdict_at);
CREATE INDEX IF NOT EXISTS idx_vo_symbol
  ON verdict_outcomes (token_symbol, verdict_at DESC);
CREATE INDEX IF NOT EXISTS idx_vo_verdict
  ON verdict_outcomes (verdict, final_grade);
CREATE INDEX IF NOT EXISTS idx_vo_user
  ON verdict_outcomes (user_address, verdict_at DESC);
