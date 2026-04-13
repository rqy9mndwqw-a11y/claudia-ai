# API Routes

## Auth Quick Reference

| Auth Function | Import | Returns | Use When |
|---------------|--------|---------|----------|
| None | — | — | Public endpoints |
| `requireAuth(req)` | `@/lib/auth` | `SessionPayload \| NextResponse` | Session only (credits, profile) |
| `requireAuthAndBalance(req, min, feat)` | `@/lib/auth` | `SessionPayload \| NextResponse` | Need token balance (scanner, trade, defi) |
| `requireMarketplaceAuth(req, opts)` | `@/lib/marketplace/middleware` | `MarketplaceAuth \| NextResponse` | Full chain (agent routes) |

---

## Public Routes (No Auth)

### GET /api/leaderboard
Purpose: Public leaderboard — top 10 qualified users
Rate limited: No (cached 5 min via Cache-Control)
Credits: None

Request: `?month=YYYY-MM` (optional, defaults to current month)

Response:
```json
{
  "month": "2026-03",
  "updatedAt": 1711612800000,
  "totalParticipants": 42,
  "top10": [{ "rank": 1, "address": "0x1234...", "displayAddress": "0x1234...5678", "score": 6500, "creditsSpent": 500, "creditsPurchased": 200, "currentStreak": 15, "longestStreak": 15, "analysesRun": 10, "lastActive": "2026-03-28" }],
  "airdropStatus": { "distributed": false },
  "nextSnapshot": "2026-03-31"
}
```

### GET /api/health
Purpose: Health check for D1 and Workers AI bindings
Rate limited: 30/min per IP

Response:
```json
{ "status": "healthy", "checks": { "d1": true, "ai": true }, "version": "..." }
```

### GET /api/yields
Purpose: Live yield pools from DeFiLlama cache
Rate limited: 30/min

Response:
```json
{ "pools": [...], "count": 50 }
```

### GET /api/session
Purpose: Generate SIWE nonce for authentication
Rate limited: 10/min per IP

Response:
```json
{ "message": "claudia.wtf wants you to sign in...", "nonce": "abc123..." }
```

### POST /api/session/verify
Purpose: Verify SIWE signature, issue session token
Rate limited: 10/min per IP

Request:
```json
{ "address": "0x...", "signature": "0x...", "message": "..." }
```

Response:
```json
{ "token": "eyJ...", "address": "0x..." }
```

---

## Session-Only Routes (requireAuth)

### GET /api/credits
Purpose: Get credit balance, tier, transaction history
Rate limited: 30/min

Response:
```json
{
  "credits": 150, "tier": "use", "total_spent": 50, "total_earned": 0,
  "address": "0x...", "created_at": "2026-03-01T...",
  "transactions": [{ "id": 1, "amount": -1, "type": "chat_spend", "reference_id": "agent-id", "balance_after": 149, "created_at": "..." }]
}
```

### POST /api/credits/purchase
Purpose: Verify on-chain CreditPurchase event, issue credits
Rate limited: 10/min per wallet

Request:
```json
{ "txHash": "0x..." }
```

Response:
```json
{ "credits_added": 60, "new_balance": 210, "claudia_spent": "...", "payment_token": "USDC", "tx_hash": "0x..." }
```

Security: Idempotent (unique index on reference_id + type='purchase'), verifies contract address, checks confirmations, validates wallet match.

### GET /api/leaderboard/me
Purpose: Current user's rank and qualification progress
Rate limited: No

Response:
```json
{
  "rank": 3, "totalParticipants": 42, "entry": { "rank": 3, "score": 6500, ... },
  "isTop10": true, "qualified": true, "rawCredits": 500, "rawActiveDays": 12,
  "progress": null
}
```

If not qualified:
```json
{
  "rank": null, "qualified": false,
  "progress": { "creditsNeeded": 120, "daysNeeded": 3 }
}
```

### POST /api/agents/apply
Purpose: Submit creator waitlist application
Rate limited: 5/min

Request:
```json
{ "contact": "email@example.com" }
```

---

## Balance-Gated Routes (requireAuthAndBalance)

### GET /api/scanner
Purpose: Get latest market scan results
Gate: dashboard (1M $CLAUDIA)
Rate limited: 30/min

Response:
```json
{
  "scannedAt": 1711612800000, "pairCount": 41,
  "results": [{ "ticker": "BTC", "price": 87000, "change24h": 2.5, "score": 8.2, "rating": "BUY", "topSignal": "RSI oversold", "rsi": 35, "reasoning": "..." }],
  "summary": "...", "topPicks": [...], "marketMood": "bullish", "nextScan": 1711620000000
}
```

### POST /api/scanner/run
Purpose: Trigger market scan (cron or manual refresh)
Gate: Cron uses `x-scanner-secret` header; manual uses session auth
Rate limited: 10min cooldown for manual, 60s for cron
Credits: 3 credits for manual refresh (refunded on failure)

### POST /api/trade/verify
Purpose: Test exchange API credentials
Gate: trading (5M $CLAUDIA)
Rate limited: 5/min

Request:
```json
{ "apiKey": "...", "apiSecret": "...", "exchange": "kraken" }
```

### POST /api/trade/scan
Purpose: Get trading signals for 1-5 pairs
Gate: trading (5M)
Rate limited: 5/min

Request:
```json
{ "watchlist": ["BTC", "ETH", "SOL"], "exchange": "kraken" }
```

### POST /api/trade/execute
Purpose: Place buy/sell order on exchange
Gate: trading (5M)
Rate limited: 10/min

Request:
```json
{ "apiKey": "...", "apiSecret": "...", "exchange": "kraken", "symbol": "BTC", "side": "buy", "amount": 100 }
```

### POST /api/claudia/analyze-pool
Purpose: Get CLAUDIA's opinion on a DeFi pool
Gate: dashboard (1M)
Rate limited: 20/min

### POST /api/claudia/compare
Purpose: Compare and rank DeFi pools
Gate: dashboard (1M)
Rate limited: 10/min

### POST /api/claudia/deposit-brief
Purpose: Quick risk brief before depositing
Gate: dashboard (1M)
Rate limited: 20/min
Note: Silently returns `{ content: null }` on Groq failure (no error logged)

### POST /api/claudia/portfolio-check
Purpose: Review portfolio positions for risks
Gate: dashboard (1M)
Rate limited: 10/min

### POST /api/claudia/risk-scores
Purpose: Batch risk scoring for pools
Gate: dashboard (1M)
Rate limited: 10/min

### POST /api/chat
Purpose: General chat with CLAUDIA (non-marketplace)
Gate: dashboard (1M)
Rate limited: Yes

---

## Marketplace Routes (requireMarketplaceAuth)

### GET /api/agents
Purpose: List public agents with filtering
Tier: browse (5M)
Rate limited: 60/min

Request: `?category=defi&search=yield&limit=50&offset=0`

### POST /api/agents
Purpose: Create new agent
Tier: create (25M), whale (100M) for premium model
Rate limited: 10/min

### GET /api/agents/:id
Purpose: Get single agent details
Tier: browse (5M)
Rate limited: 60/min

### POST /api/agents/:id/chat
Purpose: Chat with an agent
Tier: use (5M)
Rate limited: 10/min per wallet per agent
Credits: Dynamic per agent (1-3 credits). Creator doesn't pay. **Deducted BEFORE AI call, refunded on failure.**

Response:
```json
{
  "reply": "...", "agent_id": "...", "agent_name": "...", "model": "standard",
  "credits_used": 2, "credits_remaining": 148,
  "suggested_agent": { "id": "...", "name": "...", "description": "...", "icon": "..." }
}
```

### POST /api/agents/full-analysis
Purpose: Multi-agent analysis with synthesis
Tier: use (5M)
Rate limited: 5/min
Credits: 6-10 credits (dynamic based on agent count). **Deducted BEFORE analysis, refunded on failure.**

Request:
```json
{ "message": "Is ETH a good buy?", "estimateOnly": false }
```

### GET /api/agents/full-analysis/:id
Purpose: Retrieve saved analysis
Rate limited: 30/min

### GET /api/user
Purpose: Get user profile, tier, credit stats
Rate limited: 60/min

---

## Internal Routes (Worker-to-App, SCANNER_SECRET)

### POST /api/xmtp/agent
Purpose: Route XMTP chat messages to CLAUDIA agents
Gate: `x-internal-secret` header (= SCANNER_SECRET)
Rate limited: No (internal only)

Request:
```json
{ "agentType": "roast|token|scanner|portfolio|full|general", "params": { "wallet": "0x...", "query": "$ETH" } }
```

Response:
```json
{ "response": "plain text agent response for XMTP chat" }
```

### POST /api/xmtp/log-query
Purpose: Log XMTP token queries for social signal tracking
Gate: `x-internal-secret` header (= SCANNER_SECRET)
Rate limited: No (internal only)

Request:
```json
{ "tokenAddress": "0x...", "symbol": "ETH", "senderAddress": "0x...", "queryText": "analyze $ETH" }
```

### POST /api/cron/alert-outcomes
Purpose: Backfill 7d scanner alert outcomes
Gate: `x-scanner-secret` header (= SCANNER_SECRET)
Rate limited: No (cron only)

Response:
```json
{ "updated": 5, "checked": 30, "errors": 0 }
```

### GET /api/bot/health
Purpose: Heartbeat for Railway trading bot — pipeline health check
Gate: `x-claudia-secret` header (= `CLAUDIA_INTERNAL_SECRET`)
Rate limited: No (bot polls on startup + per cycle)

Response:
```json
{
  "status": "ok" | "stale" | "empty",
  "last_signal_at": "2026-04-13T23:00:00Z",
  "last_trade_at": "2026-04-13T21:30:00Z",
  "signal_count_24h": 42,
  "trade_count_24h": 3,
  "server_time": "2026-04-13T23:59:00Z"
}
```

Status derivation: `stale` when last_signal_at > 2h old OR last_trade_at > 24h old. `empty` when no rows at all.

---

## Agent Check Routes (Rug Check / Whale Alert)

### POST /api/agents/rug-check
Purpose: Credit-gated safety analysis for a contract address or symbol
Tier: use (5M)
Rate limited: 10/min per wallet
Credits: 2 credits (refunded on failure)

Request:
```json
{ "contract_address": "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B" }
```

Response:
```json
{
  "kind": "rug-check",
  "token_address": "0x98eb...",
  "token_symbol": "CLAUDIA",
  "liquidity": 250000,
  "buys24h": 120,
  "sells24h": 80,
  "analysis": "SAFETY SCORE: 8/10\\nRED FLAGS: ...\\nVERDICT: Safe",
  "credits_charged": 2
}
```

### GET /api/agents/rug-check?address=0x...
Purpose: Public cached read — no auth required. Powers `/rug-check/[address]` shareable page.
Rate limited: 30/min

Response:
```json
{ "cached": true, "result": { ... } }
```

### POST /api/agents/whale-alert
Purpose: Multi-pool volume analysis for whale accumulation signals
Tier: use (5M)
Rate limited: 10/min
Credits: 3 credits (refunded on failure)

Request:
```json
{ "contract_address": "0x940181a94A35A4569E4529A3CDfB74e38FD98631" }
```

Response:
```json
{
  "kind": "whale-alert",
  "token_symbol": "AERO",
  "total_volume": 1000000,
  "total_liquidity": 500000,
  "pool_count": 5,
  "analysis": "WHALE ACTIVITY: High\\nACCUMULATION SIGNAL: Buying\\n...",
  "credits_charged": 3
}
```

### GET /api/agents/whale-alert?address=0x...
Purpose: Public cached read

---

## Trading Routes (FLAG-GATED — pending security review)

**Gate:** `NEXT_PUBLIC_TRADE_EXECUTION_ENABLED` must equal literal string `"true"`. When off, routes return 503.

### POST /api/trading/quote
Purpose: Read-only best-price comparison across 0x + Kraken. **Not feature-flagged** — safe to expose.
Tier: use (5M)
Rate limited: 30/min per wallet
Credits: None

Request:
```json
{ "token_address": "0x...", "token_symbol": "AERO", "spend_usdc": 10 }
```

Response:
```json
{
  "quotes": [
    { "venue": "0x_base", "venue_label": "Base DEX (0x)", "price_usd": 1.84, "price_impact_pct": 0.3, "gas_estimate_usd": 0.03, "effective_price": 1.87, "available": true },
    { "venue": "kraken", "venue_label": "Kraken", "price_usd": 1.85, "fee_pct": 0.26, "available": true }
  ],
  "best": { "venue": "0x_base", ... },
  "savings_vs_worst_pct": 1.08,
  "expires_at": "2026-04-13T23:00:45Z"
}
```

### POST /api/trading/execute
Purpose: Signable 0x quote returning unsigned EIP-1559 tx. **Server never holds keys.**
Tier: use (5M)
Rate limited: 10/min
Credits: 1 credit (refunded on failure)

**Security:** `wallet_address` in body MUST equal `session.address` (case-insensitive). Any mismatch → 403.

Request:
```json
{
  "token_address": "0x...",
  "token_symbol": "AERO",
  "wallet_address": "0x...",
  "spend_usdc": 10,
  "slippage_pct": 0.5,
  "signal_id": "optional-scanner-alert-id",
  "source_page": "scanner|full-analysis|compare|watchlist|feed|direct"
}
```

Response:
```json
{
  "venue": "dex_0x_base",
  "unsigned_tx": { "to": "0x...", "data": "0x...", "value": "0", "gas": "250000", "maxFeePerGas": "...", "maxPriorityFeePerGas": "...", "chainId": 8453 },
  "allowance_target": "0x...",
  "approve_tx": { "to": "USDC_ADDR", "data": "0x095ea7b3...", "value": "0" },
  "quote": { "buy_amount": "...", "price": "1.84", "price_impact_pct": 0.3, "min_tokens_after_slippage": "...", "sources": [{"name":"Aerodrome","proportion":0.6}] },
  "expires_at": 1744588800000
}
```

Validation bounds (server-enforced):
- `spend_usdc`: [1, 10000]
- `slippage_pct`: [0.1, 5.0]
- `token_address`: strict `/^0x[0-9a-fA-F]{40}$/`

### POST /api/trading/record
Purpose: Log a broadcast trade. Idempotent — UNIQUE on `tx_hash`.
Tier: use (5M)
Rate limited: 30/min
Credits: None

Request:
```json
{
  "wallet_address": "0x...", "token_address": "0x...", "token_symbol": "AERO",
  "venue": "dex_0x_base", "spend_usdc": 10, "tokens_received": 5.43,
  "effective_price": 1.84, "price_impact_pct": 0.3, "tx_hash": "0x..."
}
```

### GET /api/trading/history?token=0x...&limit=50
Purpose: Session-scoped trade history. Wallet comes from session, never body/query. **Stays available even when execution flag is off.**
Tier: use (5M)
Rate limited: 30/min

Response:
```json
{ "trades": [{ "id": 1, "token_symbol": "AERO", "venue": "dex_0x_base", "spend_usdc": 10, "tokens_received": 5.43, "effective_price": 1.84, "tx_hash": "0x...", "created_at": "..." }] }
```

---

## Error Responses (all routes)

| Status | Meaning |
|--------|---------|
| 401 | Not authenticated (missing or expired token) |
| 403 | Insufficient $CLAUDIA balance for feature |
| 429 | Rate limited (includes Retry-After header) |
| 400 | Invalid request body or params |
| 500 | Server error |
| 502 | Unable to verify token balance (RPC failure) |
| 503 | Balance verification unavailable |
