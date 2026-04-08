-- CLAUDIA Telegram Bot — D1 schema
-- Links TG users to wallets, tracks referrals, engagement, leaderboard, polls

-- ── Telegram user accounts ──
CREATE TABLE IF NOT EXISTS telegram_users (
  tg_id TEXT PRIMARY KEY,
  wallet_address TEXT,
  username TEXT,
  display_name TEXT,
  joined_at INTEGER NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 0,
  free_queries_today INTEGER NOT NULL DEFAULT 0,
  free_queries_reset INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tg_wallet ON telegram_users(wallet_address);

-- ── Referral tracking ──
CREATE TABLE IF NOT EXISTS tg_referrals (
  id TEXT PRIMARY KEY,
  referrer_tg_id TEXT NOT NULL,
  referrer_wallet TEXT,
  referred_tg_id TEXT NOT NULL,
  referred_username TEXT,
  joined_at INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  reward_credited INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON tg_referrals(referrer_tg_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON tg_referrals(referred_tg_id);

-- ── Engagement points ──
CREATE TABLE IF NOT EXISTS tg_engagement (
  id TEXT PRIMARY KEY,
  tg_id TEXT NOT NULL,
  wallet_address TEXT,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  month TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_engagement_tg ON tg_engagement(tg_id, month);

-- ── Monthly leaderboard snapshots ──
CREATE TABLE IF NOT EXISTS tg_leaderboard (
  id TEXT PRIMARY KEY,
  tg_id TEXT NOT NULL,
  wallet_address TEXT,
  display_name TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  reward_credits INTEGER NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_month ON tg_leaderboard(month, rank);

-- ── Polls, quizzes, giveaways ──
CREATE TABLE IF NOT EXISTS tg_polls (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  tg_poll_id TEXT,
  type TEXT NOT NULL DEFAULT 'poll',
  question TEXT NOT NULL,
  options TEXT,
  entries TEXT,
  winner_tg_id TEXT,
  reward_credits INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  closes_at INTEGER
);
