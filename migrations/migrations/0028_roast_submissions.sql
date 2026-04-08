CREATE TABLE roast_submissions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  wallet_short TEXT NOT NULL,
  roast_text TEXT NOT NULL,
  roast_punchline TEXT,
  portfolio_usd REAL,
  pnl_total REAL,
  tx_count INTEGER,
  quality_score INTEGER,
  submitted_at INTEGER DEFAULT (unixepoch()),
  selected_for_rotd INTEGER DEFAULT 0,
  rotd_date TEXT,
  posted_to_x INTEGER DEFAULT 0,
  posted_to_telegram INTEGER DEFAULT 0
);

CREATE INDEX idx_roast_submissions_submitted_at ON roast_submissions(submitted_at);
CREATE INDEX idx_roast_submissions_rotd ON roast_submissions(selected_for_rotd, rotd_date);
