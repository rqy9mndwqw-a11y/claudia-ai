-- Market scanner results — bi-hourly automated analysis
CREATE TABLE IF NOT EXISTS market_scans (
  id TEXT PRIMARY KEY,
  scanned_at INTEGER NOT NULL,
  pair_count INTEGER NOT NULL,
  results TEXT NOT NULL,
  summary TEXT NOT NULL,
  top_picks TEXT NOT NULL,
  market_mood TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_scans_time
  ON market_scans(scanned_at DESC);
