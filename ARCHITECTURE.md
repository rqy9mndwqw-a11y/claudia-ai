# CLAUDIA App Architecture

## Related Documentation
- `CLAUDE_CODE.md` — Session instructions for Claude Code
- `DATABASE.md` — Complete D1 schema with column names, types, gotchas
- `COMPONENTS.md` — Component props, valid values, usage examples
- `API.md` — Every API route with auth, rate limits, request/response shapes
- `FEATURES.md` — Every shipped feature with file lists
- `SKILL.md` (repo root) — Build patterns and conventions

## Stack
- Next.js 15 App Router on Cloudflare Workers via `@opennextjs/cloudflare`
- D1 (SQLite at the edge) for database
- CF Workers AI — multi-model pipeline (Llama 8B classify, DeepSeek R1 math, Nemotron 120B reasoning)
- Groq `llama-3.3-70b-versatile` for CLAUDIA voice delivery
- wagmi + viem for wallet/Web3
- SIWE + HMAC session tokens for auth (`lib/session-token.ts`)
- Tailwind CSS, TypeScript throughout

## Critical Files — READ BEFORE TOUCHING

### NEVER modify without explicit approval:
| File | Why |
|------|-----|
| `hooks/useSessionToken.ts` | Fragile session/wagmi reconnection coupling. Took multiple sessions to fix. |
| `components/TokenGate.tsx` | sessionStorage balance cache + wagmi reconnection timing |
| `lib/verify-token.ts` | D1 balance_cache + RPC fallback with 3 retries, exponential backoff |
| `lib/marketplace/middleware.ts` | Auth chain: session -> rate limit -> D1 user -> tier check |
| `lib/rate-limit.ts` | D1-backed rate limiter. RETURNING clause removed intentionally. |
| `lib/nonce-store.ts` | D1-backed SIWE nonce, atomic consume |
| `middleware.ts` | CORS config — controls which origins hit API routes |
| `lib/gate-thresholds.ts` | Single source of truth for all token gate thresholds |

### Safe to add to:
| File/Dir | Notes |
|----------|-------|
| `lib/nav-items.ts` | Just an array of `{ href, label }` objects |
| `app/api/` new routes | Follow the API route pattern below |
| `app/[newpage]/page.tsx` | New pages |
| `migrations/` | New numbered files only — NEVER edit existing migrations |
| `components/` | New components |
| `lib/` new files | New utility modules |

## Known Fragile Coupling — Learned the Hard Way

### wagmi Reconnection Race Condition
wagmi briefly returns `{ address: defined, isConnected: false }` during page navigation.
This is NOT a real disconnect.

- NEVER clear session based on wagmi connection state alone.
- ONLY clear session when address goes from defined -> undefined.
- `useSessionToken` uses `prevAddressRef` to detect real disconnects.
- DO NOT change this logic.

### Next.js SSR / Hydration Null Flash
localStorage is unavailable during SSR.
`useSessionToken` uses a lazy state initializer to read localStorage synchronously on first client render.

- NEVER move session reading into a useEffect.
- NEVER depend on useEffect timing for auth-gated fetches.

### TokenGate Balance Check Timing
wagmi is in reconnecting state briefly after navigation.
TokenGate must NOT show rejection while wagmi reconnects.
Uses sessionStorage cache (60s TTL) to persist gate result across navigation.

- NEVER show rejection UI while balance check is still loading.
- NEVER re-check balance on navigation if valid cache exists.
- The 3-second wait timer handles wagmi reconnection window.

### balance_cache is Primary Balance Source
`requireTier` checks on-chain balance via RPC — can take up to 19s.
`balance_cache` table in D1 caches results for 60 seconds.

- ALWAYS check balance_cache before hitting RPC.
- ALWAYS use expired cache as fallback if RPC fails.
- NEVER return 403 just because RPC is slow.

## What Breaks What

| If you change...          | It can break...                              |
|---------------------------|----------------------------------------------|
| `useSessionToken`         | TokenGate, all agent fetches, SIWE prompt    |
| `TokenGate`               | All gated pages, agents, marketplace         |
| `requireTier`             | All API routes, agent chat, marketplace      |
| `middleware.ts`           | CORS, all API requests from frontend         |
| credit deduction logic    | All credit flows, agent chat, full analysis  |
| wagmi config              | All of the above simultaneously              |
| `nav-items.ts`            | Nothing critical — safe to edit              |

## Auth Patterns

There are THREE auth functions. Use the right one:

### `requireAuth(req)` — session only
Location: `lib/auth.ts`
Returns: `SessionPayload | NextResponse`
Use for: Routes that need a logged-in user but no balance/tier check (e.g., credits page, profile).

### `requireAuthAndBalance(req, minBalance, feature)` — session + on-chain balance
Location: `lib/auth.ts`
Returns: `SessionPayload | NextResponse`
Use for: Non-marketplace routes that need a minimum token balance.

### `requireMarketplaceAuth(req, { ratePrefix, rateMax, rateWindowMs })` — full auth chain
Location: `lib/marketplace/middleware.ts`
Returns: `MarketplaceAuth { session, user, db } | NextResponse`
Use for: Marketplace routes. Includes session check, per-wallet rate limit, D1 user record.
Follow with `requireTier(db, user, tierName)` if tier gating needed.

## API Route Pattern

Every authenticated route follows this structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Auth — always first
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    // 2. Get D1
    const db = getDB();

    // 3. Parameterized queries only
    const data = await db.prepare("SELECT * FROM table WHERE address = ?")
      .bind(session.address).all();

    // 4. Return
    return NextResponse.json({ data: data.results });
  } catch (err) {
    console.error("Route error:", (err as Error).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

For marketplace routes (need user record + rate limit):
```typescript
import { requireMarketplaceAuth, requireTier } from "@/lib/marketplace/middleware";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMarketplaceAuth(req, { ratePrefix: "myroute", rateMax: 10, rateWindowMs: 60_000 });
    if (auth instanceof NextResponse) return auth;
    const { session, user, db } = auth;

    const tierError = await requireTier(db, user, "browse");
    if (tierError) return tierError;

    // ... business logic
  } catch (err) {
    console.error("Route error:", (err as Error).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

## Public API Routes

No auth required. Cache aggressively.

```typescript
export async function GET() {
  const db = getDB();
  // No session check
  const data = await db.prepare("SELECT ...").all();
  return NextResponse.json({ data: data.results }, {
    headers: { "Cache-Control": "public, max-age=300" }
  });
}
```

## D1 Query Rules

ALWAYS parameterized:
```typescript
// CORRECT
await db.prepare("SELECT * FROM users WHERE address = ?").bind(address).first();

// NEVER
await db.prepare(`SELECT * FROM users WHERE address = '${address}'`);
```

Atomic operations use `db.batch([...])` — all-or-nothing execution.

## Credit System

### Three deduction functions in `lib/marketplace/db.ts`:

| Function | Use Case | Creator Split |
|----------|----------|---------------|
| `deductCreditsAtomic(db, userAddr, creatorAddr, amount, agentId)` | Agent chat | 80% creator, 20% platform |
| `deductPlatformCredits(db, userAddr, amount, referenceId)` | Full analysis, premium features | No split |
| `addCreditsAtomic(db, addr, amount, type, referenceId)` | Purchases, refunds, bonuses | N/A |

### Credit deduction pattern (deduct BEFORE expensive operation):
```typescript
await deductPlatformCredits(db, session.address, cost, referenceId);
try {
  // Run expensive AI operation
} catch (error) {
  // Refund on failure
  await addCreditsAtomic(db, session.address, cost, "refund", `error:${referenceId}`);
  throw error;
}
```

### credit_transactions table schema:
```
id          INTEGER PRIMARY KEY AUTOINCREMENT
address     TEXT NOT NULL          -- wallet address (lowercase)
amount      INTEGER NOT NULL       -- positive = credit, negative = debit
type        TEXT NOT NULL          -- purchase | chat_spend | creator_earn | refund | bonus
reference_id TEXT                  -- agent_id for chat, tx_hash for purchase
balance_after INTEGER NOT NULL
created_at  TEXT DEFAULT datetime('now')
```

**Note:** Column is `address`, NOT `user_address`. Any SQL joining this table must use `address`.

## Token Gate Thresholds

From `lib/gate-thresholds.ts` (single source of truth):
```
dashboard:         1,000,000    (1M $CLAUDIA)
trading:           5,000,000    (5M)
marketplace_browse: 5,000,000   (5M)
marketplace_use:    5,000,000   (5M)
marketplace_create: 25,000,000  (25M)
marketplace_whale:  100,000,000 (100M)
```

## AI Model Pipeline

```
User query
  -> Step 1: CF Llama 8B — classify intent (free, ~200ms, temp 0.1)
  -> Step 2a: CF DeepSeek R1 — math analysis (math-heavy agents only)
  -> Step 2b: CF Nemotron 120B — deep reasoning + synthesis
              Fallback: CF Llama 70B if Nemotron fails
  -> Step 3: Groq llama-3.3-70b-versatile — CLAUDIA voice delivery (temp 0.7)
  -> Nuclear fallback: directGroqFallback() if entire pipeline fails
```

Math-heavy agents (get DeepSeek R1 pass): risk-check, chart-reader, yield-scout, token-analyst.

## ClaudiaCharacter Component

Location: `components/ClaudiaCharacter.tsx`

**Props:** `{ imageSrc: string, mood: ClaudiaMood, message?: string, className?: string }`

**Available moods:** `"idle" | "impatient" | "thinking" | "excited" | "skeptical" | "talking"`

**Sizes:** NO size prop. Fixed at `w-28 h-28 md:w-36 md:h-36` (112px mobile, 144px desktop).
If a size prop is needed, it must be added to the component.

**Note:** `imageSrc` is required — it does NOT auto-resolve. The component renders an `<img>` tag.
There is NO `"smug"` mood. There is NO `size="small"` or `size="tiny"`.

## D1 Tables (in migration order)

| Migration | Tables Created |
|-----------|---------------|
| 0001_agent_marketplace | `users`, `agents`, `chat_messages`, `credit_transactions` |
| 0002_seed_agents | (seed data for agents table) |
| 0002_unique_purchase_tx | (unique index on credit_transactions) |
| 0003_nonces_and_rate_limits | `nonces`, `rate_limits` |
| 0004_creator_applications | `creator_applications` |
| 0005_agent_example_prompts | (added column to agents) |
| 0006_agent_collaboration | (agent collaboration features) |
| 0007_balance_cache | `balance_cache` |
| 0008_full_analysis | `full_analyses` |
| 0009_market_scanner | `market_scans` |
| 0010_scanner_trigger | (scanner trigger setup) |

Next migration number: **0011**

## Environment Variables

### Worker Secrets (set via `wrangler secret put`):
- `SESSION_SECRET` — HMAC session token signing (min 32 chars)
- `GROQ_API_KEY` — Groq API for CLAUDIA voice delivery
- `TAAPI_KEY` — TAAPI.IO technical analysis indicators
- `ZERION_API_KEY` — Zerion API for portfolio wallet data
- `SCANNER_SECRET` — Scanner cron auth
- `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` — Twitter/X API

### Build-time (`.env.local`, baked into JS):
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_CLAUDIA_CONTRACT` = `0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B`
- `NEXT_PUBLIC_MIN_CLAUDIA_BALANCE` = `1000000`
- `NEXT_PUBLIC_APPROVED_CREATORS`

**NEVER use hardcoded credential fallbacks. Empty string or throw on missing.**

## CORS (middleware.ts)

Only these origins are allowed to hit `/api/*`:
- `https://claudia.wtf`
- `https://app.claudia.wtf`
- `https://www.claudia.wtf`

Requests with no origin (server-to-server, curl, cron) are allowed through.

## Navigation

`lib/nav-items.ts` — array of `{ href, label }`:
1. Scanner -> `/scanner`
2. Agents -> `/agents`
3. DeFi -> `/defi`
4. Chat -> `/chat`
5. Portfolio -> `/portfolio`
6. Credits -> `/credits`
7. Trade -> `/trade`

## Deployment

```bash
cd claudia-app
npx tsc --noEmit              # must be zero errors
npx opennextjs-cloudflare build
npx wrangler deploy --env production
```

D1 migrations:
```bash
# Production
npx wrangler d1 execute claudia-marketplace --file=migrations/XXXX.sql --remote --env production
# Staging
npx wrangler d1 execute claudia-marketplace-staging --file=migrations/XXXX.sql --remote
```

D1 database IDs:
- Production: `5454cf38-3b0d-4966-b861-91ca85674de2` (name: `claudia-marketplace`)
- Staging: `5250cb5b-f64f-44ca-97a2-6dd7610a9432` (name: `claudia-marketplace-staging`)

## Rules for Every Build

1. Read this file before touching anything
2. Run `npx tsc --noEmit` after every change
3. Never touch `useSessionToken` without explicit approval
4. Never touch `TokenGate` without explicit approval
5. Never touch `middleware.ts` without explicit approval
6. Always use parameterized D1 queries — never string interpolation
7. Always deduct credits BEFORE expensive operations, refund on failure
8. New pages go in `app/[name]/page.tsx` with `"use client"` if interactive
9. New API routes go in `app/api/[name]/route.ts`
10. New migrations get the next number (currently 0011) — never edit existing migrations
11. Internal navigation uses `<Link href="...">` from `next/link`, NOT `<a href="...">`
12. `credit_transactions` column is `address` not `user_address`
13. `getDB()` comes from `@/lib/marketplace/db` — uses `getCloudflareContext()` from `@opennextjs/cloudflare`
14. Test these 5 flows after ANY auth-related change:
    - Fresh connect -> sign -> navigate -> come back to agents
    - Hard refresh on agents page
    - Navigate away -> come back to agents
    - Actually disconnect wallet -> reconnect
    - Mobile wallet flow
