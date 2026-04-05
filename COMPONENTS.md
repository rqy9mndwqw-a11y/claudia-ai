# Shared Components

## ClaudiaCharacter
File: `components/ClaudiaCharacter.tsx`
Purpose: Animated CLAUDIA avatar with mood-based styling, word-by-word message display, and idle message rotation.

Props:
- `imageSrc`: string (required) — Always pass `"/claudia-avatar.png"`
- `mood`: ClaudiaMood (required) — `"idle"` | `"impatient"` | `"thinking"` | `"excited"` | `"skeptical"` | `"talking"`
- `size`: ClaudiaSize (optional, default `"medium"`) — `"tiny"` | `"small"` | `"medium"` | `"large"`
- `message`: string (optional) — Text to display word-by-word
- `className`: string (optional) — Additional CSS classes

Size details:
- `tiny`: 32x32px, no glow/dot/text bubble
- `small`: 64x64px, no glow/dot/text bubble
- `medium`: 112px mobile / 144px desktop (original default), full effects
- `large`: 160x160px, full effects

Notes:
- There is NO `"smug"` mood — use `"idle"` instead
- `imageSrc` is required, not optional — will render broken img without it
- `size="tiny"` and `size="small"` hide the glow, status dot, and text bubble
- Idle message rotation only triggers when `mood="idle"` and no message prop
- Exports: `ClaudiaMood` type, `ClaudiaSize` type

Usage:
```tsx
<ClaudiaCharacter imageSrc="/claudia-avatar.png" mood="excited" size="small" />
<ClaudiaCharacter imageSrc="/claudia-avatar.png" mood="thinking" message="analyzing..." />
<ClaudiaCharacter imageSrc="/claudia-avatar.png" mood="idle" size="tiny" />
```

---

## ClaudiaAvatar
File: `components/ClaudiaAvatar.tsx`
Purpose: Separate avatar component with different state machine — head tilt animations and quip rotation.

Props:
- `state`: AvatarState (required) — `"idle"` | `"thinking"` | `"responding"` | `"sideeye"` | `"smug"`

Notes:
- This is a DIFFERENT component from ClaudiaCharacter
- Has its own state types that don't overlap with ClaudiaMood
- Used in ChatInterface for the chat-specific avatar experience

---

## TokenGate
File: `components/TokenGate.tsx`
Purpose: Gate content behind $CLAUDIA token balance check. DO NOT MODIFY.

Props:
- `children`: ReactNode (required) — Content to show when balance is sufficient
- `minBalance`: number (optional, default `GATE_THRESHOLDS.dashboard` = 1M) — Required token balance
- `featureName`: string (optional, default `"Claudia AI"`) — Name shown in error message

Notes:
- Caches balance in sessionStorage (60s TTL)
- 3-second wait for wagmi reconnection on page load
- Falls back to cached balance if RPC fails
- FRAGILE — do not modify without explicit approval

Usage:
```tsx
<TokenGate minBalance={GATE_THRESHOLDS.dashboard}>
  <ProtectedContent />
</TokenGate>
```

---

## AppHeader
File: `components/ui/AppHeader.tsx`
Purpose: Navigation header with logo, nav items, streak display, burned count, and wallet connect.

Props: None

Notes:
- Renders `NAV_ITEMS` from `lib/nav-items.ts`
- Shows streak count (fire-and-forget fetch from /api/leaderboard/me)
- Shows burned $CLAUDIA count
- Uses `<a>` tags for nav items (not `<Link>`) — matches existing pattern

---

## MobileNav
File: `components/ui/MobileNav.tsx`
Purpose: Slide-in mobile navigation drawer.

Props: None

---

## Badge
File: `components/ui/Badge.tsx`
Purpose: Reusable styled badge for categories, risk levels, chains, etc.

Props:
- `variant`: string (required) — `"chain-base"` | `"chain-ethereum"` | `"risk-safe"` | `"risk-moderate"` | `"risk-risky"` | `"risk-trash"` | `"tag-stable"` | `"tag-il"` | `"tag-outlier"` | `"tag-audit"` | `"pick"` | `"neutral"`
- `size`: string (optional) — `"sm"` (11px) | `"md"` (12px)
- `children`: ReactNode (required)
- `className`: string (optional)
- `title`: string (optional)

Exports: `Badge`, `chainVariant(chain)`, `riskVariant(level)`

---

## WalletConnect
File: `components/WalletConnect.tsx`
Purpose: Wallet connection button using RainbowKit.

Props: None

States: Not connected → Connect button, Wrong chain → Switch button, Connected → Green dot + shortened address

---

## AgentCard
File: `components/AgentCard.tsx`
Purpose: Agent marketplace card with icon, name, category, usage stats.

Props:
- `agent`: AgentPublic (required) — from `lib/marketplace/types.ts`

Exports: `AgentCard` (grid view), `AgentRow` (dense list view)

---

## PoolCard
File: `components/PoolCard.tsx`
Purpose: DeFi pool card with APY, TVL, risk scores, protocol info.

Props:
- `pool`: Pool (required) — from `hooks/usePools.ts`
- `isAnalyzing`: boolean (required)
- `onAnalyze`: () => void (required)
- `onDeposit`: () => void (optional) — shown only if protocol supports deposits

---

## DepositWizard
File: `components/DepositWizard.tsx`
Purpose: Multi-step DeFi deposit flow (select amount → review → sign → monitor).

Props:
- `pool`: Pool (required)
- `onClose`: () => void (required)

---

## ErrorBoundary
File: `components/ErrorBoundary.tsx`
Purpose: React error boundary for catching render errors.

Props:
- `children`: ReactNode (required)
- `fallback`: ReactNode (optional)

---

## Providers
File: `components/Providers.tsx`
Purpose: Root context wrapper for Wagmi, RainbowKit, React Query, Toast.

Props:
- `children`: ReactNode (required)

Notes:
- Theme: Dark with accent color `#E8295B`
- Includes hydration mismatch prevention (mounted check)

---

## FloatingClaudia
File: `components/FloatingClaudia.tsx`
Purpose: Floating CLAUDIA avatar overlay visible across all pages.

Props: None

---

## ChatInterface
File: `components/ChatInterface.tsx`
Purpose: Main chat UI with message history, yields panel, CLAUDIA mood integration.

Props: None (uses hooks internally)

---

## HandoffCard
File: `components/HandoffCard.tsx`
Purpose: Agent suggestion card shown in chat when CLAUDIA suggests a specialist.

Props:
- `agent`: SuggestedAgent (required) — `{ id, name, description, icon }`

---

## ComparisonPanel
File: `components/ComparisonPanel.tsx`
Purpose: Side-by-side pool/token comparison with metrics table.

Props: Varies by usage context.

---

## TxStepIndicator
File: `components/TxStepIndicator.tsx`
Purpose: Multi-step transaction progress display.

Props:
- `steps`: TxStep[] (required)
- `currentStep`: number (required)
- `status`: StepStatus (required)

---

## Skeleton
File: `components/ui/Skeleton.tsx`
Purpose: Loading placeholder with pulse animation.
