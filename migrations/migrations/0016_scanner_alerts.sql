-- Scanner Alert Performance Tracker
-- Saves scanner signals (score >= 7) with prices at alert time,
-- then checks 24h/48h performance for follow-up tweets.

CREATE TABLE IF NOT EXISTS scanner_alerts (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  tweet_id TEXT,                    -- original tweet ID for threading replies
  symbol TEXT NOT NULL,
  score INTEGER NOT NULL,
  rating TEXT NOT NULL,
  reasoning TEXT,
  price_at_alert REAL NOT NULL,
  price_24h REAL,
  price_48h REAL,
  change_24h REAL,                  -- percentage
  change_48h REAL,                  -- percentage
  alerted_at INTEGER NOT NULL,      -- epoch ms
  checked_24h INTEGER DEFAULT 0,    -- 0/1 boolean
  checked_48h INTEGER DEFAULT 0,
  followup_tweet_24h TEXT,          -- tweet ID of 24h follow-up
  followup_tweet_48h TEXT
);

CREATE INDEX IF NOT EXISTS idx_scanner_alerts_checked ON scanner_alerts (checked_24h, checked_48h, alerted_at);
CREATE INDEX IF NOT EXISTS idx_scanner_alerts_symbol ON scanner_alerts (symbol);
