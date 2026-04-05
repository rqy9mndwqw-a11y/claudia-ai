-- Base arena tables (from Task 8 spec, not yet created)
CREATE TABLE IF NOT EXISTS nft_fighters (
  token_id INTEGER PRIMARY KEY,
  owner_address TEXT NOT NULL,
  tier TEXT NOT NULL,
  signal_strength INTEGER DEFAULT 50,
  accuracy_rating INTEGER DEFAULT 50,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  active_skills TEXT DEFAULT '[]',
  unlocked_traits TEXT DEFAULT '[]',
  is_bot INTEGER DEFAULT 0,
  heated_state INTEGER DEFAULT 0,
  heated_since INTEGER,
  current_win_streak INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS arena_battles (
  id TEXT PRIMARY KEY,
  battle_type TEXT NOT NULL,
  fighter_1_token_id INTEGER NOT NULL,
  fighter_2_token_id INTEGER,
  fighter_2_is_bot INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  winner_token_id INTEGER,
  fighter_1_prediction TEXT,
  fighter_2_prediction TEXT,
  fighter_1_accuracy REAL,
  fighter_2_accuracy REAL,
  fighter_1_heated INTEGER DEFAULT 0,
  fighter_2_heated INTEGER DEFAULT 0,
  fighter_1_battle_log TEXT,
  fighter_2_battle_log TEXT,
  target_asset TEXT,
  is_scanner_sourced INTEGER DEFAULT 0,
  resolves_at INTEGER,
  started_at INTEGER,
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS arena_predictions (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES arena_battles(id),
  predictor_address TEXT NOT NULL,
  predicted_winner INTEGER NOT NULL,
  credit_amount INTEGER NOT NULL,
  is_correct INTEGER,
  payout_amount INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS nft_skills (
  id TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  acquired_at INTEGER DEFAULT (unixepoch()),
  acquired_via TEXT
);

-- Bounties
CREATE TABLE IF NOT EXISTS bounties (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_asset TEXT NOT NULL,
  bounty_type TEXT NOT NULL,
  target_condition TEXT NOT NULL,
  reward_claudia INTEGER NOT NULL,
  posted_by TEXT NOT NULL,
  posted_by_token_id INTEGER,
  status TEXT DEFAULT 'active',
  claimed_by_token_id INTEGER,
  claimed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bounty_attempts (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL REFERENCES bounties(id),
  token_id INTEGER NOT NULL,
  battle_id TEXT,
  prediction TEXT NOT NULL,
  outcome TEXT,
  is_correct INTEGER,
  attempted_at INTEGER DEFAULT (unixepoch())
);

-- Killfeed
CREATE TABLE IF NOT EXISTS killfeed_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  color TEXT DEFAULT '#39ff14',
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounty_attempts_bounty ON bounty_attempts(bounty_id);
CREATE INDEX IF NOT EXISTS idx_killfeed_created ON killfeed_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_fighters_owner ON nft_fighters(owner_address);
CREATE INDEX IF NOT EXISTS idx_arena_battles_status ON arena_battles(status);
CREATE INDEX IF NOT EXISTS idx_nft_skills_token ON nft_skills(token_id);
