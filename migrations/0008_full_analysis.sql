-- Full multi-agent analysis results
CREATE TABLE IF NOT EXISTS full_analyses (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  question TEXT NOT NULL,
  agent_results TEXT NOT NULL,
  synthesis TEXT NOT NULL,
  claudia_verdict TEXT NOT NULL,
  credits_charged INTEGER NOT NULL DEFAULT 5,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_full_analyses_user
  ON full_analyses(user_address, created_at DESC);
