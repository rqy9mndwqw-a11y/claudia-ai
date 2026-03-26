-- Agent Marketplace Schema
-- D1 (SQLite at the edge)

-- Users: wallet address is the primary identity (from SIWE session)
CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,                     -- lowercase 0x... wallet address
  tier TEXT NOT NULL DEFAULT 'browse',          -- browse | use | create | whale
  credits INTEGER NOT NULL DEFAULT 0,           -- current credit balance (integer, no decimals)
  total_earned INTEGER NOT NULL DEFAULT 0,      -- lifetime earnings as agent creator
  total_spent INTEGER NOT NULL DEFAULT 0,       -- lifetime credits spent
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agents: user-created AI agents with custom system prompts
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,                          -- nanoid or uuid
  creator_address TEXT NOT NULL,                -- wallet address of creator
  name TEXT NOT NULL,                           -- display name (max 60 chars)
  description TEXT NOT NULL,                    -- short description (max 280 chars)
  category TEXT NOT NULL DEFAULT 'general',     -- defi | trading | research | degen | general
  icon TEXT NOT NULL DEFAULT '🤖',              -- emoji avatar
  system_prompt TEXT NOT NULL,                  -- the agent's personality/instructions (max 2000 chars)
  model TEXT NOT NULL DEFAULT 'standard',       -- standard (8B) | premium (70B)
  cost_per_chat INTEGER NOT NULL DEFAULT 1,     -- credits per interaction (creator sets this)
  is_public INTEGER NOT NULL DEFAULT 1,         -- 1 = listed in marketplace, 0 = unlisted
  usage_count INTEGER NOT NULL DEFAULT 0,       -- total interactions
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',        -- active | suspended | deleted
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (creator_address) REFERENCES users(address)
);

-- Chat messages: conversation history per user per agent
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  user_address TEXT NOT NULL,
  role TEXT NOT NULL,                           -- user | assistant
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (user_address) REFERENCES users(address)
);

-- Credit transactions: audit log for all credit movements
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,                        -- wallet address
  amount INTEGER NOT NULL,                      -- positive = credit, negative = debit
  type TEXT NOT NULL,                           -- purchase | chat_spend | creator_earn | refund | bonus
  reference_id TEXT,                            -- agent_id for chat, tx_hash for purchase
  balance_after INTEGER NOT NULL,               -- balance after this transaction
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (address) REFERENCES users(address)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category, status, is_public);
CREATE INDEX IF NOT EXISTS idx_agents_creator ON agents(creator_address);
CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_lookup ON chat_messages(agent_id, user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_address ON credit_transactions(address, created_at DESC);
