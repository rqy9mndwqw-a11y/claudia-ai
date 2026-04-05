# Claude Code — Session Instructions

## Read before every session
1. `ARCHITECTURE.md` — critical coupling and do-not-touch list
2. `DATABASE.md` — exact table schemas and column names
3. `COMPONENTS.md` — component props and valid values
4. This file

## Session start checklist
- [ ] Read ARCHITECTURE.md
- [ ] Read the files relevant to your task
- [ ] Report what you found — don't assume
- [ ] List every file you plan to touch
- [ ] Flag any mismatches between the prompt and reality

## Before writing any code
Always show findings first. Never write code based on assumptions.
If something in the prompt doesn't match reality — flag it.
If a function name doesn't exist — say so before using it.
If a table column has a different name — say so before writing SQL.

## Deployment rules
1. Never fix more than one thing per deploy
2. Run `npx tsc --noEmit` after every change — zero errors required
3. Never deploy without TypeScript passing
4. Test in browser after every deploy before moving to next task

## Files that will break everything if touched wrong
See ARCHITECTURE.md for the full list. Short version:
- `hooks/useSessionToken.ts` — wagmi reconnection timing
- `components/TokenGate.tsx` — sessionStorage balance cache
- `middleware.ts` — CORS for all API routes
- `lib/marketplace/db.ts` — atomic credit operations
- `lib/marketplace/middleware.ts` — auth chain
- `lib/verify-token.ts` — RPC retry + D1 cache
- `lib/rate-limit.ts` — D1-backed, RETURNING clause removed intentionally
- `lib/nonce-store.ts` — atomic nonce consume

## When you're unsure
Stop and ask. Don't guess. Don't "try it and see".
A broken deploy is worse than a delayed one.

## Common mistakes to avoid
- `credit_transactions` uses column `address`, NOT `user_address`
- `ClaudiaCharacter` requires `imageSrc="/claudia-avatar.png"` — always
- Valid ClaudiaMood: idle, impatient, thinking, excited, skeptical, talking — NO "smug"
- Valid ClaudiaSize: tiny, small, medium (default), large
- Import `getDB` from `@/lib/marketplace/db`, not anywhere else
- Import `requireAuth` from `@/lib/auth` for session-only routes
- Import `requireMarketplaceAuth` from `@/lib/marketplace/middleware` for full auth chain
- `requireAuthAndBalance` exists in `@/lib/auth` — used by non-marketplace gated routes
- Timestamps: some tables use TEXT datetime, others use INTEGER unix — check DATABASE.md
- Internal navigation uses `<Link>` from `next/link`, NOT `<a href="...">`
- All D1 queries must be parameterized with `.bind()` — never string interpolation
- Credit deduction happens BEFORE expensive operations, refund on failure
- Activity tracking (leaderboard) is fire-and-forget — `.catch(() => {})`, never blocks

## Auth function quick reference
| Function | Location | Use when |
|----------|----------|----------|
| `requireAuth(req)` | `lib/auth.ts` | Session only, no balance check (credits, profile, leaderboard/me) |
| `requireAuthAndBalance(req, min, feat)` | `lib/auth.ts` | Need minimum token balance (scanner, trade, defi analysis) |
| `requireMarketplaceAuth(req, opts)` | `lib/marketplace/middleware.ts` | Full chain: session + rate limit + D1 user record (agent routes) |

## Migration rules
- Check highest existing number before creating: `ls migrations/`
- Never edit existing migration files
- Always create new numbered file
- Run on both staging and production D1 databases

## File creation rules
- New pages: `app/[name]/page.tsx` with `"use client"` if interactive
- New API routes: `app/api/[name]/route.ts`
- New hooks: `hooks/use[Name].ts`
- New lib modules: `lib/[name].ts` or `lib/[name]/index.ts`
- New components: `components/[Name].tsx`
