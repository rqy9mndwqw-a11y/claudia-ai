-- Rug-check / whale-alert result cache.
-- Powers the shareable /rug-check/[address] and /whale-alert pages: viewers
-- see the last analysis without re-running it (no credits consumed on view).
-- Only the original caller is charged — subsequent page visitors read cache.

CREATE TABLE IF NOT EXISTS agent_check_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,             -- 'rug-check' | 'whale-alert'
  token_address TEXT NOT NULL,    -- lowercase ERC-20 address
  token_symbol TEXT,
  token_name TEXT,
  chain TEXT,
  requester_address TEXT NOT NULL, -- wallet that paid for the check
  result_json TEXT NOT NULL,      -- full analysis payload
  created_at TEXT NOT NULL,
  UNIQUE(kind, token_address)
);

CREATE INDEX IF NOT EXISTS idx_agent_check_kind_addr
  ON agent_check_results(kind, token_address);
CREATE INDEX IF NOT EXISTS idx_agent_check_requester
  ON agent_check_results(requester_address);
