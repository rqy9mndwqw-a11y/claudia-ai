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
