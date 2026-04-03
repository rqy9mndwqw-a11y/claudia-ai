-- CLAUDIA Feed — auto-populated activity feed from agent analyses

CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  post_type TEXT NOT NULL,        -- 'agent_post' | 'alpha_alert' | 'market_scan'
  agent_job TEXT,                 -- job type that triggered it
  title TEXT NOT NULL,
  content TEXT NOT NULL,          -- CLAUDIA's summary (max 280 chars for feed display)
  full_content TEXT,              -- full analysis JSON for drill-down
  verdict TEXT,                   -- 'Buy' | 'Hold' | 'Avoid' | null
  score INTEGER,                 -- 1-10 or null
  risk TEXT,                     -- 'Low' | 'Medium' | 'High' | 'Very High' | null
  token_symbol TEXT,             -- token/pair this is about if applicable
  upvotes INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  author_address TEXT,           -- null = CLAUDIA agent post, wallet = community post
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created
  ON feed_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_posts_type
  ON feed_posts(post_type, created_at DESC);
