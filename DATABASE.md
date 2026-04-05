# D1 Database Schema

D1 databases:
- Production: `claudia-marketplace` (ID: `5454cf38-3b0d-4966-b861-91ca85674de2`)
- Staging: `claudia-marketplace-staging` (ID: `5250cb5b-f64f-44ca-97a2-6dd7610a9432`)

## Timestamp Warning

Two formats coexist in this database:
- **TEXT datetime**: `datetime('now')` — used by tables from migration 0001 (users, agents, chat_messages, credit_transactions, creator_applications)
- **INTEGER unix ms**: `Date.now()` — used by tables from migration 0003+ (nonces, rate_limits, balance_cache, full_analyses, market_scans, user_activity, leaderboard_snapshots)

These are NOT compatible. Never mix them in queries.

---

## Tables

### users
Migration: 0001_agent_marketplace.sql
Purpose: Wallet-based user accounts with credit balance and tier.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| address | TEXT PRIMARY KEY | — | Lowercase 0x... wallet address |
| tier | TEXT NOT NULL | 'browse' | Enum: `browse`, `use`, `create`, `whale` |
| credits | INTEGER NOT NULL | 0 | Current credit balance |
| total_earned | INTEGER NOT NULL | 0 | Lifetime creator earnings |
| total_spent | INTEGER NOT NULL | 0 | Lifetime credits spent |
| created_at | TEXT NOT NULL | datetime('now') | TEXT format |
| updated_at | TEXT NOT NULL | datetime('now') | TEXT format |

---

### agents
Migration: 0001 + 0005 + 0006
Purpose: AI agents with custom system prompts, created by users or CLAUDIA.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PRIMARY KEY | — | nanoid or uuid |
| creator_address | TEXT NOT NULL | — | FK → users(address). `0x0000...0000` = CLAUDIA official |
| name | TEXT NOT NULL | — | Max 60 chars |
| description | TEXT NOT NULL | — | Max 280 chars |
| category | TEXT NOT NULL | 'general' | Enum: `defi`, `trading`, `research`, `degen`, `general` |
| icon | TEXT NOT NULL | '🤖' | Emoji |
| system_prompt | TEXT NOT NULL | — | Max 2000 chars |
| model | TEXT NOT NULL | 'standard' | Enum: `standard` (8B), `premium` (70B) |
| cost_per_chat | INTEGER NOT NULL | 1 | Credits per interaction |
| is_public | INTEGER NOT NULL | 1 | 0/1 boolean |
| usage_count | INTEGER NOT NULL | 0 | Total interactions |
| upvotes | INTEGER NOT NULL | 0 | |
| downvotes | INTEGER NOT NULL | 0 | |
| status | TEXT NOT NULL | 'active' | Enum: `active`, `suspended`, `deleted` |
| example_prompts | TEXT NOT NULL | '[]' | JSON array of strings (added 0005) |
| related_agents | TEXT NOT NULL | '[]' | JSON array of agent IDs (added 0006) |
| created_at | TEXT NOT NULL | datetime('now') | TEXT format |
| updated_at | TEXT NOT NULL | datetime('now') | TEXT format |

Indexes: `idx_agents_category(category, status, is_public)`, `idx_agents_creator(creator_address)`, `idx_agents_usage(usage_count DESC)`

---

### chat_messages
Migration: 0001_agent_marketplace.sql
Purpose: Conversation history per user per agent.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PRIMARY KEY | AUTOINCREMENT | |
| agent_id | TEXT NOT NULL | — | FK → agents(id) |
| user_address | TEXT NOT NULL | — | FK → users(address) |
| role | TEXT NOT NULL | — | Enum: `user`, `assistant` |
| content | TEXT NOT NULL | — | |
| created_at | TEXT NOT NULL | datetime('now') | TEXT format |

Index: `idx_chat_messages_lookup(agent_id, user_address, created_at DESC)`

---

### credit_transactions
Migration: 0001 + 0002 (unique index)
Purpose: Audit log for all credit movements.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PRIMARY KEY | AUTOINCREMENT | |
| **address** | TEXT NOT NULL | — | FK → users(address). **NOT `user_address`** |
| amount | INTEGER NOT NULL | — | Positive = credit, negative = debit |
| type | TEXT NOT NULL | — | Enum: `purchase`, `chat_spend`, `creator_earn`, `refund`, `bonus` |
| reference_id | TEXT | NULL | agent_id for chat, tx_hash for purchase |
| balance_after | INTEGER NOT NULL | — | Balance after this transaction |
| created_at | TEXT NOT NULL | datetime('now') | TEXT format |

Indexes:
- `idx_credit_transactions_address(address, created_at DESC)`
- `idx_credit_transactions_unique_purchase(reference_id, type) WHERE type = 'purchase'` — UNIQUE, prevents duplicate purchase claims

**GOTCHA: Column is `address`, not `user_address`. Every JOIN must use `address`.**

---

### nonces
Migration: 0003_nonces_and_rate_limits.sql
Purpose: Single-use SIWE nonces for authentication.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| nonce | TEXT PRIMARY KEY | — | Random nonce string |
| created_at | INTEGER NOT NULL | — | Unix timestamp ms |
| used | INTEGER NOT NULL | 0 | 0 = unused, 1 = consumed |

TTL: 5 minutes. Lazy cleanup of nonces > 10 min old.

---

### rate_limits
Migration: 0003_nonces_and_rate_limits.sql
Purpose: Fixed-window rate limiting across CF Worker isolates.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| key | TEXT NOT NULL | — | Format: `prefix:identity` |
| window_start | INTEGER NOT NULL | — | Unix timestamp |
| count | INTEGER NOT NULL | 1 | Request count in window |

Primary Key: `(key, window_start)` — composite

---

### creator_applications
Migration: 0004_creator_applications.sql
Purpose: Waitlist for agent creator access.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PRIMARY KEY | AUTOINCREMENT | |
| address | TEXT NOT NULL | — | Wallet address, UNIQUE |
| contact | TEXT NOT NULL | — | Email or telegram (3-200 chars) |
| created_at | TEXT NOT NULL | datetime('now') | TEXT format |

---

### balance_cache
Migration: 0007_balance_cache.sql
Purpose: Cache on-chain token balance to avoid 19s RPC retries.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| address | TEXT PRIMARY KEY | — | Wallet address |
| balance | TEXT NOT NULL | — | Stringified balance value |
| checked_at | INTEGER NOT NULL | — | Unix timestamp |

TTL: 60 seconds. Expired cache used as fallback if RPC fails.

---

### full_analyses
Migration: 0008_full_analysis.sql
Purpose: Saved multi-agent analysis results.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PRIMARY KEY | — | |
| user_address | TEXT NOT NULL | — | Soft FK → users(address) |
| question | TEXT NOT NULL | — | |
| agent_results | TEXT NOT NULL | — | JSON array of agent analysis objects |
| synthesis | TEXT NOT NULL | — | JSON: consensus, conflicts, recommendation, risk |
| claudia_verdict | TEXT NOT NULL | — | JSON: score, verdict, risk, opinion |
| credits_charged | INTEGER NOT NULL | 5 | |
| created_at | INTEGER NOT NULL | — | Unix timestamp |

Index: `idx_full_analyses_user(user_address, created_at DESC)`

---

### market_scans
Migration: 0009 + 0010
Purpose: Bi-hourly AI market scan results.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PRIMARY KEY | — | |
| scanned_at | INTEGER NOT NULL | — | Unix timestamp |
| pair_count | INTEGER NOT NULL | — | |
| results | TEXT NOT NULL | — | JSON array of ScanResult objects |
| summary | TEXT NOT NULL | — | |
| top_picks | TEXT NOT NULL | — | JSON array of top picks |
| market_mood | TEXT NOT NULL | — | Enum: `bullish`, `neutral`, `mixed`, `bearish` |
| trigger_type | TEXT NOT NULL | 'auto' | Added in 0010. `auto` or `manual` |

Index: `idx_market_scans_time(scanned_at DESC)`

---

### user_activity
Migration: 0011_leaderboard.sql
Purpose: Daily activity tracking for leaderboard scoring and streaks.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PRIMARY KEY | — | UUID |
| user_address | TEXT NOT NULL | — | Soft FK → users(address) |
| activity_date | TEXT NOT NULL | — | Format: YYYY-MM-DD |
| credits_spent | INTEGER NOT NULL | 0 | Accumulated via UPSERT |
| messages_sent | INTEGER NOT NULL | 0 | |
| analyses_run | INTEGER NOT NULL | 0 | |
| created_at | INTEGER NOT NULL | — | Unix timestamp |

Unique: `(user_address, activity_date)`
Indexes: `idx_activity_user(user_address, activity_date DESC)`, `idx_activity_date(activity_date DESC)`

---

### leaderboard_snapshots
Migration: 0011_leaderboard.sql
Purpose: End-of-month leaderboard snapshots for airdrop distribution.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PRIMARY KEY | — | |
| month | TEXT NOT NULL | — | Format: YYYY-MM |
| snapshot_date | INTEGER NOT NULL | — | Unix timestamp |
| rankings | TEXT NOT NULL | — | JSON array of ranked wallet objects |
| total_participants | INTEGER NOT NULL | 0 | |
| airdrop_amount | INTEGER | NULL | Nullable — CLAUDIA tokens distributed |
| airdrop_tx | TEXT | NULL | Nullable — Base transaction hash |
| created_at | INTEGER NOT NULL | — | Unix timestamp |

Index: `idx_snapshots_month(month DESC)`

---

## External Data Sources

### CoinPaprika (`lib/data/coinpaprika.ts`)
- Base URL: `https://api.coinpaprika.com/v1`
- Auth: None required (free tier)
- Rate limit: 25,000 calls/month
- Cache TTL: 60s for prices, 1hr for metadata, 5min for global
- Used by: Token Analyst (price + metadata), Security Checker (metadata only)
- Key endpoints: `/tickers/{id}`, `/coins/{id}`, `/global`, `/search`
- Ticker mapping: `TICKER_TO_ID` constant (20 tokens mapped)

### DexPaprika (`lib/data/dexpaprika.ts`)
- Base URL: `https://api.dexpaprika.com`
- Auth: None required
- Rate limit: 10,000 requests/day
- Cache TTL: 60s for tokens, 5min for pools
- Used by: Memecoin Radar (on-chain DEX data when contract address provided)
- Key endpoints: `/networks/base/tokens/{address}`, `/networks/base/pools`
- CLAUDIA token helper: `getClaudiaTokenData()` fetches $CLAUDIA on-chain data
