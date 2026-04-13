/**
 * Discount tiers — derive a user's effective pricing from their $CLAUDIA
 * balance. Ties into the existing TIER_THRESHOLDS system in gate-thresholds.ts
 * so there's one source of truth for gate tiers.
 *
 * Used by:
 *   - TierWidget in the nav header
 *   - Future server-side pricing middleware (emits X-Claudia-Discount headers)
 *
 * Semantics:
 *   browse  (5M+)       → 10% off platform credits
 *   use     (5M+)       → same as browse baseline (already gated)
 *   create  (25M+)      → 25% off + earn creator revenue share
 *   whale   (100M+)     → 40% off + free daily allowance
 */

import { TIER_THRESHOLDS } from "./gate-thresholds";

export type TierKey = "none" | "dashboard" | "browse" | "use" | "create" | "whale";

export interface DiscountTier {
  key: TierKey;
  label: string;
  minBalance: number;
  discountPct: number; // 0-100
  freeDailyCredits: number;
  description: string;
}

// Ordered ASCENDING by minBalance so highest-qualifying tier wins after filter.
export const DISCOUNT_TIERS: DiscountTier[] = [
  {
    key: "none",
    label: "Visitor",
    minBalance: 0,
    discountPct: 0,
    freeDailyCredits: 0,
    description: "Connect wallet to unlock free credits.",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    minBalance: 1_000_000,
    discountPct: 0,
    freeDailyCredits: 0,
    description: "Dashboard access. No discount yet — 5M unlocks pricing.",
  },
  {
    key: "use",
    label: "User",
    minBalance: TIER_THRESHOLDS.use, // 5M
    discountPct: 10,
    freeDailyCredits: 0,
    description: "10% off all credit packs.",
  },
  {
    key: "create",
    label: "Creator",
    minBalance: TIER_THRESHOLDS.create, // 25M
    discountPct: 25,
    freeDailyCredits: 5,
    description: "25% off · 5 free credits/day · create agents (80% rev share).",
  },
  {
    key: "whale",
    label: "Whale",
    minBalance: TIER_THRESHOLDS.whale, // 100M
    discountPct: 40,
    freeDailyCredits: 20,
    description: "40% off · 20 free credits/day · 70B model access.",
  },
];

/**
 * Given a $CLAUDIA balance (in whole tokens), return the qualifying tier.
 * Always returns a tier — "none" when balance is 0.
 */
export function getDiscountTier(balance: number): DiscountTier {
  const b = Math.max(0, balance || 0);
  const qualifying = DISCOUNT_TIERS.filter((t) => b >= t.minBalance);
  return qualifying[qualifying.length - 1] ?? DISCOUNT_TIERS[0];
}

/** Returns the next-higher tier, or null if already at whale. */
export function getNextTier(balance: number): DiscountTier | null {
  const current = getDiscountTier(balance);
  const idx = DISCOUNT_TIERS.findIndex((t) => t.key === current.key);
  return DISCOUNT_TIERS[idx + 1] ?? null;
}

/**
 * Apply the balance-tier discount to a base USDC price.
 * Returns { discounted, original, discountPct }.
 */
export function calculateDiscountedPrice(
  basePrice: number,
  balance: number
): { discounted: number; original: number; discountPct: number } {
  const tier = getDiscountTier(balance);
  const discountPct = tier.discountPct;
  const discounted = Math.max(
    0,
    Math.round((basePrice * (100 - discountPct)) * 100) / 10000
  );
  return { discounted, original: basePrice, discountPct };
}

/**
 * True when the caller qualifies for a free allowance (daily credits).
 * Independent of remaining free balance — the caller is responsible for
 * checking the per-day usage counter separately.
 */
export function isFreeAccess(balance: number): boolean {
  return getDiscountTier(balance).freeDailyCredits > 0;
}

/** How many $CLAUDIA needed to reach the next tier. Zero if already at top. */
export function tokensToNextTier(balance: number): number {
  const next = getNextTier(balance);
  if (!next) return 0;
  return Math.max(0, next.minBalance - balance);
}
