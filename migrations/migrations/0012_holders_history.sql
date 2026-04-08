CREATE TABLE IF NOT EXISTS holders_history (
  id TEXT PRIMARY KEY,
  holders_count INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  recorded_date TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holders_date
  ON holders_history(recorded_date);
