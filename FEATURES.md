# Shipped Features

## Agent Marketplace
Status: LIVE
Description: Users can browse, chat with, and create AI agents. Each agent has a custom system prompt, pricing tier, and personality delivered through CLAUDIA's voice. 10 official CLAUDIA agents ship by default. Creators earn 80% of credits spent on their agents.

Key files:
- `app/agents/page.tsx` — Agent marketplace browser
- `app/agents/[id]/page.tsx` — Individual agent detail + chat
- `app/agents/create/page.tsx` — Agent creation form
- `app/agents/guide/page.tsx` — Creator documentation
- `app/api/agents/route.ts` — List/create agents
- `app/api/agents/[id]/route.ts` — Get single agent
- `app/api/agents/[id]/chat/route.ts` — Chat endpoint (credit deduction + AI pipeline)
- `app/api/agents/apply/route.ts` — Creator waitlist
- `lib/agent-pipeline.ts` — Multi-model AI pipeline
- `lib/cloudflare-ai.ts` — CF Workers AI wrapper
- `lib/claudia-voice.ts` — CLAUDIA personality prompts
- `lib/marketplace/db.ts` — All D1 operations + credit atomics
- `lib/marketplace/middleware.ts` — Auth chain + tier gating
- `lib/marketplace/validation.ts` — Input validation
- `lib/marketplace/agent-routing.ts` — Agent handoff/suggestion logic
- `lib/credits/agent-tiers.ts` — Agent pricing tiers
- `components/AgentCard.tsx` — Agent display card
- `migrations/0001_agent_marketplace.sql` — Core schema
- `migrations/0002_seed_agents.sql` — Default agents

Notes: Pipeline uses 3-4 models (8B classify → optional DeepSeek R1 math → Nemotron 120B reason → Groq voice). Credits deducted before AI call, refunded on failure.

Data sources per agent:
- All agents: CoinGecko prices (via Polygon)
- Chart Reader, Risk Manager: Polygon OHLCV + RSI
- Token Analyst: Polygon OHLCV + volume + CoinPaprika fundamentals (market cap, supply, team, beta)
- Security Checker: CoinPaprika metadata (team, links, description)
- Memecoin Radar: DexScreener trending + DexPaprika on-chain DEX data (when contract address provided)
- Yield Scout, Risk Manager: Polygon economic context (treasury yields, CPI)
- Base Guide, Memecoin Radar: DexScreener trending pairs

---

## Full Analysis (Multi-Agent)
Status: LIVE
Description: Routes a question to 3-5 specialist agents in parallel, synthesizes results via Nemotron, then delivers a final CLAUDIA verdict via Groq. Saved to D1 for later retrieval.

Key files:
- `app/api/agents/full-analysis/route.ts` — Analysis endpoint
- `app/api/agents/full-analysis/[id]/route.ts` — Retrieve saved analysis
- `app/analysis/[id]/page.tsx` — Analysis detail page
- `migrations/0008_full_analysis.sql` — full_analyses table

Notes: 6-10 credits per analysis (dynamic). Estimate-only mode returns cost without running.

---

## Credit System
Status: LIVE
Description: Users buy credits with USDC on Base via the ClaudiaCredits smart contract. Credits are spent on agent interactions and premium features. Atomic D1 operations ensure consistency. 80/20 split between creator and platform.

Key files:
- `app/credits/page.tsx` — Purchase and manage credits
- `app/api/credits/route.ts` — Get balance and history
- `app/api/credits/purchase/route.ts` — Verify purchase tx + issue credits
- `lib/marketplace/db.ts` — `deductCreditsAtomic`, `addCreditsAtomic`, `deductPlatformCredits`
- `lib/gate-thresholds.ts` — Credit packages and pricing
- `hooks/useCredits.ts` — Client-side credit state
- `contracts/ClaudiaCredits.sol` — On-chain purchase contract

Notes: ClaudiaCredits contract at `0x34C2F4c5dcd5D62365673Bc6f44180efb8a81151`. Idempotent purchase verification (unique index prevents double-claims).

---

## Auth & Session
Status: LIVE
Description: SIWE (Sign-In With Ethereum) authentication with HMAC-signed stateless session tokens. 24h TTL. Works across CF Worker isolates. Session persists in localStorage, survives page refresh.

Key files:
- `hooks/useSessionToken.ts` — SIWE auth flow + localStorage persistence (FRAGILE)
- `lib/session-token.ts` — HMAC token creation/verification
- `lib/session.ts` — SIWE signature verification
- `lib/nonce-store.ts` — Single-use nonces
- `lib/auth.ts` — `requireAuth`, `requireAuthAndBalance`, `rateLimit`
- `lib/marketplace/middleware.ts` — `requireMarketplaceAuth`, `requireTier`
- `app/api/session/route.ts` — Nonce generation
- `app/api/session/verify/route.ts` — Signature verification + token issuance

Notes: wagmi reconnection race condition is the biggest landmine. See ARCHITECTURE.md.

---

## Token Gate
Status: LIVE
Description: Client-side $CLAUDIA token balance verification. Caches balance in sessionStorage (60s TTL). Shows purchase link to Aerodrome if insufficient.

Key files:
- `components/TokenGate.tsx` — Balance gate component (FRAGILE)
- `lib/verify-token.ts` — Server-side balance verification with D1 cache
- `lib/gate-thresholds.ts` — Threshold definitions
- `lib/contracts.ts` — CLAUDIA token address and ABI
- `migrations/0007_balance_cache.sql` — balance_cache table

Notes: 3-second wait for wagmi reconnection. Falls back to cached balance if RPC fails.

---

## Market Scanner
Status: LIVE
Description: AI-powered bi-hourly scan of 41 crypto pairs. Uses CoinGecko for prices, Polygon for OHLCV/RSI, DeepSeek R1 for scoring, Groq for summary. Manual refresh costs 3 credits.

Key files:
- `app/scanner/page.tsx` — Scanner UI
- `app/api/scanner/route.ts` — Get latest scan
- `app/api/scanner/run/route.ts` — Trigger scan (cron or manual)
- `lib/scanner/market-scanner.ts` — Scan engine
- `migrations/0009_market_scanner.sql` — market_scans table
- `migrations/0010_scanner_trigger.sql` — Added trigger_type column

Notes: Cron uses `x-scanner-secret` header. Keeps only last 24 scans in DB.

---

## Scanner Alert History & Outcomes
Status: LIVE
Description: Normalized alert history with 7d outcome tracking. Injected into Full Analysis context. XMTP query count serves as social signal.

Key files:
- `lib/data/scanner-history.ts` — Query helpers + formatters (prompt and XMTP variants)
- `lib/scanner/performance-check.ts` — Existing 24h/48h inline tracking
- `app/api/cron/alert-outcomes/route.ts` — 7d outcome backfill cron (TAAPI + DexScreener fallback)
- `migrations/0016_scanner_alerts.sql` — scanner_alerts table (score, rating, price tracking)
- `migrations/0034_xmtp_and_scanner_outcomes.sql` — scanner_alert_outcomes + xmtp_token_queries

Notes: 24h/48h outcomes tracked inline on scanner_alerts. 7d outcomes in separate scanner_alert_outcomes table. Alert history auto-injected into Full Analysis agent context.

---

## XMTP Agent
Status: LIVE
Description: Railway-hosted Node.js service using @xmtp/agent-sdk V3. CLAUDIA accessible via encrypted XMTP chat in Base app, Converse, and any XMTP client.

Key files:
- `claudia-xmtp/src/index.ts` — @xmtp/agent-sdk entry (long-running process)
- `claudia-xmtp/src/router.ts` — Intent parsing and agent routing
- `claudia-xmtp/src/ratelimit.ts` — Upstash Redis rate limit + Zerion token gate
- `claudia-xmtp/src/types.ts` — Shared types
- `app/api/xmtp/agent/route.ts` — Internal endpoint (XMTP agent calls this)
- `app/api/xmtp/log-query/route.ts` — Token query logging for social signals

Notes: Uses dedicated agent wallet (NOT treasury). Free tier: 3 queries/day (Upstash Redis). Token-gated: 25K $CLAUDIA for unlimited. Full analysis requires token gate. All responses plain text (no markdown). XMTP identity auto-registers on first startup.

---

## DeFi Dashboard
Status: LIVE
Description: Browse yield pools from DeFiLlama, get CLAUDIA's risk analysis, compare pools, check portfolio positions, deposit into Aave V3.

Key files:
- `app/defi/page.tsx` — DeFi hub
- `app/api/claudia/analyze-pool/route.ts` — Pool opinion
- `app/api/claudia/compare/route.ts` — Pool comparison/ranking
- `app/api/claudia/deposit-brief/route.ts` — Pre-deposit risk brief
- `app/api/claudia/portfolio-check/route.ts` — Portfolio review
- `app/api/claudia/risk-scores/route.ts` — Batch risk scoring
- `app/api/yields/route.ts` — Yield data from DeFiLlama
- `hooks/usePools.ts` — Pool filtering and state
- `hooks/useRiskScores.ts` — Risk score fetching
- `hooks/usePortfolio.ts` — Position aggregation
- `lib/risk-scorer.ts` — Groq-powered risk scoring
- `lib/yields-cache.ts` — DeFiLlama cache
- `lib/defi-adapters/` — Protocol deposit adapters (Aave V3 live, Aerodrome stubbed)
- `lib/protocol-adapters/` — Position reading (Aave, Aerodrome)
- `components/PoolDashboard.tsx`, `PoolCard.tsx`, `DepositWizard.tsx`, `PortfolioOverview.tsx`, `ComparisonPanel.tsx`

---

## Trading
Status: LIVE
Description: Connect exchange API keys, scan pairs for signals, execute buy/sell orders on Kraken/Coinbase.

Key files:
- `app/trade/page.tsx` — Trading UI
- `app/api/trade/verify/route.ts` — Verify exchange credentials
- `app/api/trade/scan/route.ts` — Get trading signals (RSI, SMA, volatility)
- `app/api/trade/execute/route.ts` — Place orders
- `lib/exchange.ts` — Unified exchange REST API
- `lib/kraken.ts` — Kraken-specific client
- `lib/kraken-pairs.ts` — Supported pairs list
- `components/TradeInterface.tsx` — Trade form

Notes: API keys passed in request body, never stored server-side. Supports market/limit orders with stop-loss/take-profit.

---

## Chat
Status: LIVE
Description: Direct chat with CLAUDIA (non-marketplace). DeFi-focused with live yield data panel.

Key files:
- `app/chat/page.tsx` — Chat page
- `app/api/chat/route.ts` — Chat endpoint
- `components/ChatInterface.tsx` — Chat UI with yields panel
- `hooks/useClaudiaMood.ts` — Mood state machine
- `components/ClaudiaAvatar.tsx` — Chat-specific avatar

---

## Leaderboard
Status: LIVE
Description: Monthly competition. Users earn points from credits spent (10x), daily streak (50x), and credits purchased (5x). Top 10 qualified users get $CLAUDIA airdrops. Minimum: 500 credits spent + 7 active days.

Key files:
- `app/leaderboard/page.tsx` — Leaderboard UI with rank card + qualification bars
- `app/api/leaderboard/route.ts` — Public top 10 endpoint
- `app/api/leaderboard/me/route.ts` — Personal rank endpoint
- `lib/leaderboard/calculate.ts` — Scoring engine
- `lib/leaderboard/track-activity.ts` — Fire-and-forget activity tracking
- `migrations/0011_leaderboard.sql` — user_activity + leaderboard_snapshots tables

Notes: Activity tracked via deductCreditsAtomic and deductPlatformCredits (fire-and-forget, never blocks). Streak displayed in AppHeader.

---

## Floating CLAUDIA
Status: LIVE
Description: Floating CLAUDIA avatar visible across all pages with mood-reactive animations and idle message rotation.

Key files:
- `components/FloatingClaudia.tsx` — Floating overlay
- `components/ClaudiaCharacter.tsx` — Character component
- `app/layout.tsx` — Mounted in root layout

---

## Token Data Router (Agent Fake-Data Fix)
Status: LIVE
Description: Single entry point for resolving any token reference (symbol or address) to its correct data source — TAAPI CEX / DexScreener DEX / on-chain / unknown. Replaces the `tickers[0] || "BTC/USD"` fallback pattern that caused agents to analyze BTC data when users asked about non-CEX tokens.

Key files:
- `lib/data/token-router.ts` — `extractTokenRef()`, `resolveTokenDataSource()`, `formatDexScreenerContext()`
- `lib/data/agent-data.ts` — all affected agents (chart-reader, risk-check, token-analyst, security-check, memecoin-radar) rewired through the router
- `lib/data/format-context.ts` — renders TARGET TOKEN banner + ⚠️ NO CEX INDICATORS warning when `taapiUnavailable` is true
- `app/api/agents/full-analysis/route.ts` — routes tokens via `resolveTokenDataSource()` before fetching any data
- `tests/data/token-router.test.ts` — 18 tests

Notes: Empty token messages now return `null` (not `BTC/USD`). Prompt hard-guards against hallucinating RSI/MACD for tokens without CEX listings. Agents must prefix "Limited data available (no CEX indicators)..." when TAAPI unavailable.

---

## Rug Check (standalone page)
Status: LIVE (migration 0042 pending)
Description: Paste a contract address, get a safety score 1-10 + verdict (Safe / Caution / Danger / Run). Results are publicly shareable at `/rug-check/[address]` — viewers don't consume credits.

Key files:
- `app/rug-check/page.tsx` — Input form
- `app/rug-check/[address]/page.tsx` — Shareable result (public, no auth)
- `app/api/agents/rug-check/route.ts` — Credit-gated POST (2 credits) + public GET for cached read
- `migrations/0042_rug_check_cache.sql` — `agent_check_results` table (kind + token_address UNIQUE)

Notes: CoinGecko fundamentals only injected for CEX-listed tokens. Caching: subsequent viewers of the same address hit the cached result.

---

## Whale Alert (standalone page)
Status: LIVE (migration 0042 pending)
Description: Multi-pool volume analysis to spot accumulation patterns. Cross-pool volume concentration + buy/sell imbalance + liquidity-vs-volume ratio → accumulation signal.

Key files:
- `app/whale-alert/page.tsx` — Input + result
- `app/api/agents/whale-alert/route.ts` — Credit-gated POST (3 credits) + cache GET
- Shares `agent_check_results` table with rug-check (migration 0042)

---

## Scanner Universe Builder
Status: BUILT, not yet wired into scanner worker
Description: Dynamic multi-source universe replaces the hardcoded 75-pair list. Sources: CoinGecko top-50, DexScreener Base trending + gainers (1h/4h), CoinGecko 24h gainers, user watchlists, Flashblocks launches. Tier-sorted with rotation strategy.

Key files:
- `lib/scanner/universe.ts` — `buildScanUniverse()`, `assembleUniverse()` pure reducer
- `migrations/0043_scanner_alert_source.sql` — adds `alert_source` column to scanner_alerts
- `tests/scanner/universe.test.ts` — 9 tests

Rotation (pending wire-up in `workers/scanner/worker.js`):
- Cycle 0: Tier 1 + gainers 1h/4h
- Cycle 1: Tier 1 + 24h gainers + trending
- Cycle 2: same as Cycle 0
- Cycle 3: Tier 1 + Flashblocks launches
- Cap 50 tokens/cycle, KV key `scanner:rotation_index` mod 4

---

## Trade Execution / Act on Signal (FLAG-GATED, SECURITY REVIEW PENDING)
Status: BUILT — `NEXT_PUBLIC_TRADE_EXECUTION_ENABLED` flag is OFF. Do not flip until security review passes.
Description: One-tap DEX swap on Base via 0x aggregator. Server returns unsigned EIP-1559 tx; client signs via wagmi. Server never holds keys. Kraken shown for price comparison only — no CEX execution.

Key files:
- `lib/trading/config.ts` — Feature flag, bounds (SLIPPAGE 0.1-5.0%, SPEND $1-$10k, QUOTE_TTL 45s)
- `lib/trading/route-scanner.ts` — Parallel venue quote scan (0x + Kraken ticker)
- `app/api/trading/quote/route.ts` — Read-only price comparison (not feature-flagged)
- `app/api/trading/execute/route.ts` — Signable 0x quote; `takerAddress` pinned to `session.address`
- `app/api/trading/record/route.ts` — Post-broadcast idempotent logger (UNIQUE on tx_hash)
- `app/api/trading/history/route.ts` — Session-scoped trade history
- `components/trading/TradeSignal.tsx` — Full state machine (IDLE→QUOTING→QUOTED→APPROVING→EXECUTING→DONE)
- `components/trading/TradeButton.tsx` — Canonical entry point with symbol→address resolution
- `components/portfolio/PortfolioTradeHistory.tsx` — Recent Trades on portfolio page
- `migrations/0044_user_trades.sql` — user_trades table (UNIQUE tx_hash)
- `tests/trading/route-scanner.test.ts` + `tests/trading/execute-validation.test.ts` — 31 tests combined

Security properties documented in `app/api/trading/execute/route.ts` docblock — 6 items require security reviewer sign-off before flag flip.

Wire-ups: Scanner detail drawer, /compare page (both tokens). Full analysis + watchlist + daily-signal surfaces can drop in `<TradeButton>` when ready.

---

## Portfolio Risk Badge
Status: LIVE
Description: Colored badge in portfolio header showing 0-100 risk score. Click expands per-token breakdown. Pure client-side computation from loaded portfolio data — no extra API call.

Key files:
- `lib/portfolio/risk-score.ts` — `computePortfolioRisk()` + tier heuristic (stables/majors/blue-chips/memes/unknown)
- `components/portfolio/PortfolioRiskBadge.tsx` — Badge + expandable breakdown
- `tests/portfolio/risk-score.test.ts` — 12 tests

Scoring: USD-weighted per-token tier + concentration penalty (up to +20 when single non-stable holding >40%).

---

## Tier Widget (Discount Tiers)
Status: LIVE
Description: Compact tier chip in nav header next to wallet. Click opens slide-out with current tier, next tier requirement, discount %, free credits/day, "Get $CLAUDIA →" CTA.

Key files:
- `lib/discount-tiers.ts` — `DISCOUNT_TIERS`, `getDiscountTier()`, `calculateDiscountedPrice()`, `isFreeAccess()`, `tokensToNextTier()`
- `components/TierWidget.tsx` — Header chip + slide-out
- `components/ui/AppHeader.tsx` — Widget mounted next to WalletConnect
- `tests/discount-tiers.test.ts` — 12 tests

Tiers: none (0) → dashboard (1M, 0% off) → use (5M, 10% off) → create (25M, 25% off + 5 free credits/day) → whale (100M, 40% off + 20 free credits/day).

---

## Payment Confirmation Toast (Forward-Compat Wire-Up)
Status: PLUMBING LIVE — activates when server routes emit `X-Claudia-Discount` / `X-Claudia-Tier` / `X-Claudia-Amount` / `X-Claudia-Tx-Hash` / `X-From-Cache` headers.

Key files:
- `components/PaymentToastProvider.tsx` — Context + `emitPaymentFromHeaders(res, action)` helper
- `components/PaymentConfirmation.tsx` — Toast UI (4s auto-dismiss)
- Wired into: dashboard, feed, agents list, agent detail (chat + full-analysis), scanner, chat

Notes: Toast is silent until headers appear. Cached responses (`X-From-Cache: 1`) are suppressed — no payment occurred.

---

## Bot Health Endpoint
Status: LIVE
Description: `/api/bot/health` — heartbeat for the Railway trading bot. Returns last_signal_at / last_trade_at / 24h counts / status (ok/stale/empty). Bot calls on startup + every sync cycle.

Key files:
- `app/api/bot/health/route.ts` — shared-secret auth via `x-claudia-secret`
- `src/d1_sync.py` — `check_d1_connection()` + `check_app_health()` helpers; multi-name env vars; 3-retry/5s backoff

Notes: Required CF Worker secret `CLAUDIA_INTERNAL_SECRET` must match the Railway env var.

---

## 404 + Error Pages
Status: LIVE
Description: Custom CLAUDIA-branded 404 (`4¿4` glitched) and 500 pages with Dashboard/Arena nav buttons. CSS variables only.

Key files:
- `app/not-found.tsx`
- `app/error.tsx`

---

## Flashblocks Worker
Status: BUILT, KV created, deploy pending
Description: Every-minute cron that reconnects to Base Flashblocks WebSocket for 25s windows; detects new token launches before confirmation.

Key files:
- `workers/flashblocks/worker.js`
- `workers/flashblocks/wrangler.toml` — FLASHBLOCKS_KV id `afb630340641406b973b3da182532513`
