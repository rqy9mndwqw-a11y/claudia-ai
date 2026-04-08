/**
 * Single source of truth for all CLAUDIA token gate thresholds.
 * Import this everywhere — no hardcoded numbers anywhere else.
 *
 * Used by:
 * - TokenGate component (client-side balance check)
 * - requireAuthAndBalance (server-side, non-marketplace routes)
 * - requireTier (server-side, marketplace routes)
 * - Credits page tier display
 */

// ── Feature gate thresholds (in $CLAUDIA tokens) ──

export const GATE_THRESHOLDS = {
  dashboard: 1_000_000,
  trading: 5_000_000,
  marketplace_browse: 5_000_000,
  marketplace_use: 5_000_000,
  marketplace_create: 25_000_000,
  marketplace_whale: 100_000_000,
} as const;

// ── Tier thresholds for marketplace (derived from GATE_THRESHOLDS) ──
// Used by requireTier() and credits page tier display

export const TIER_THRESHOLDS = {
  browse: GATE_THRESHOLDS.marketplace_browse,
  use: GATE_THRESHOLDS.marketplace_use,
  create: GATE_THRESHOLDS.marketplace_create,
  whale: GATE_THRESHOLDS.marketplace_whale,
} as const;

// ── Feature names for error messages ──

export const FEATURE_NAMES: Record<string, string> = {
  dashboard: "Claudia AI",
  trading: "Claudia Trading Bot",
  marketplace_browse: "Agent Marketplace",
  marketplace_use: "Agent Marketplace",
  marketplace_create: "Agent Creation",
  marketplace_whale: "Premium Model",
};

// ── Credit packages (fixed USDC pricing) ──

export const CREDIT_PACKAGES = [
  { id: "starter",  credits: 10,  usdcPrice: 1,  label: "Starter" },
  { id: "standard", credits: 60,  usdcPrice: 5,  label: "Standard" },
  { id: "pro",      credits: 150, usdcPrice: 10, label: "Pro" },
  { id: "whale",    credits: 400, usdcPrice: 25, label: "Whale" },
] as const;

// ── Agent interaction costs ──

export const AGENT_COSTS = {
  basic: 1,    // Basic agent query
  complex: 3,  // Complex analysis
  premium: 10, // Premium 70B model
} as const;
