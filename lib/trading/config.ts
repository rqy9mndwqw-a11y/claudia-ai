/**
 * Trading feature configuration.
 *
 * DEPLOY GUARD: the full trade-execution feature is gated behind the
 * `NEXT_PUBLIC_TRADE_EXECUTION_ENABLED` env flag. When OFF:
 *   - `/api/trading/execute` and `/api/trading/record` return 503.
 *   - `TradeSignal` component + "Trade this signal" button render nothing.
 *   - `/api/trading/quote` (read-only price comparison) STAYS ON — it
 *     doesn't touch funds, so the audit doesn't block it.
 *
 * Default: OFF. Flip to "true" only after the security review has signed off
 * on the takerAddress binding, slippage bounds, and approval flow.
 */

export const TRADE_EXECUTION_ENABLED =
  process.env.NEXT_PUBLIC_TRADE_EXECUTION_ENABLED === "true";

// ── Slippage bounds ──
// Under 0.1% is almost always unfillable on L2. Over 5% is dangerous — the
// UI still surfaces the option but the server caps here.
export const SLIPPAGE_MIN_PCT = 0.1;
export const SLIPPAGE_MAX_PCT = 5.0;
export const SLIPPAGE_DEFAULT_PCT = 0.5;

// ── Spend limits (USDC) ──
export const SPEND_MIN_USDC = 1;
export const SPEND_MAX_USDC = 10_000; // per-trade cap. Raise after audit.

// ── Quote TTL ──
// Matches the 30s → 45s decision. Keep this constant — the UI countdown
// reads it so the client/server can't drift.
export const QUOTE_TTL_SEC = 45;

// ── Credit cost for using the routing feature ──
// The trade itself costs gas + DEX fees paid from the user's wallet.
// The 1 credit covers the server-side quote + 0x API use.
export const TRADE_ROUTING_CREDIT_COST = 1;

// ── On-chain constants (Base mainnet) ──
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_USDC_DECIMALS = 6;
export const BASE_CHAIN_ID = 8453;

// ── Basescan ──
export const BASESCAN_TX_URL = (hash: string) => `https://basescan.org/tx/${hash}`;
