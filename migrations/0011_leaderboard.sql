-- Track daily activity for streak calculation
CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  analyses_run INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_address, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_user
  ON user_activity(user_address, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_date
  ON user_activity(activity_date DESC);

-- Monthly leaderboard snapshots
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  snapshot_date INTEGER NOT NULL,
  rankings TEXT NOT NULL,
  total_participants INTEGER NOT NULL DEFAULT 0,
  airdrop_amount INTEGER,
  airdrop_tx TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_month
  ON leaderboard_snapshots(month DESC);
