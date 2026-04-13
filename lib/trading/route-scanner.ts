/**
 * Trading route scanner — read-only best-price router.
 *
 * SCOPE: quote comparison only. This module does NOT execute trades or
 * produce signed transactions. Execution lives in a separate route that
 * returns unsigned tx bytes for the client wallet to sign, pending a
 * dedicated security review.
 *
 * Venues scanned in parallel:
 *   - 0x aggregator (Base chain) — any Base token via public /swap/v1/price
 *   - Kraken public ticker       — major pairs only (BTC/ETH/SOL/etc.)
 *
 * Aerodrome direct quoting is deliberately deferred — it requires an on-chain
 * call (Router.getAmountsOut) and is already covered by 0x's router lookup.
 *
 * Quote lifetime: 30 seconds (enforced by caller — the struct we return has
 * `expires_at`; UI must re-fetch before allowing execute).
 */

import { SUPPORTED_PAIRS } from "@/lib/kraken";

// ── Types ─────────────────────────────────────────────────────────────────

export type Venue = "kraken" | "0x_base" | "aerodrome";

export interface VenueQuote {
  venue: Venue;
  venue_label: string;
  /** Price per token in USD. */
  price_usd: number;
  /** Percentage impact on liquidity pools (0x/DEX only). */
  price_impact_pct: number;
  /** Venue fee in percentage. */
  fee_pct: number;
  /** Estimated gas cost in USD (DEX only). 0 for CEX. */
  gas_estimate_usd: number;
  /** Total cost to acquire `tokens_out` tokens including fees + gas. */
  total_cost_usd: number;
  /** Total cost / tokens_out — the real comparable price. */
  effective_price: number;
  /** Tokens received for `spend_usdc` at this venue. */
  tokens_out: number;
  available: boolean;
  error?: string;
}

export interface RouteScanResult {
  quotes: VenueQuote[];
  best: VenueQuote | null;
  /** Percent the best quote beats the worst by. 0 if ≤1 quote. */
  savings_vs_worst_pct: number;
  /** ISO timestamp after which the quotes are stale. */
  expires_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
const KRAKEN_TAKER_FEE_PCT = 0.26;
const ZEROX_FEE_PCT = 0; // 0x itself is free; DEX swap fees are in `price` quote
const BASE_GAS_ESTIMATE_USD = 0.03; // conservative single-swap gas on Base L2
const QUOTE_TTL_SEC = 30;

// ── Venue fetchers ────────────────────────────────────────────────────────

/**
 * 0x public price (indicative — NOT signable). Good enough for comparison.
 * The signable quote lives on `/swap/v1/quote` and requires a wallet ctx;
 * we leave that to the execute route when/if it ships.
 */
async function fetchZeroXBaseQuote(
  tokenAddress: string,
  spendUsdc: number
): Promise<VenueQuote> {
  const base: VenueQuote = {
    venue: "0x_base",
    venue_label: "Base DEX (0x)",
    price_usd: 0,
    price_impact_pct: 0,
    fee_pct: ZEROX_FEE_PCT,
    gas_estimate_usd: BASE_GAS_ESTIMATE_USD,
    total_cost_usd: spendUsdc,
    effective_price: 0,
    tokens_out: 0,
    available: false,
  };

  if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
    return { ...base, error: "Invalid token address" };
  }

  // USDC on Base has 6 decimals
  const sellAmount = BigInt(Math.round(spendUsdc * 1_000_000)).toString();

  try {
    const url =
      `https://base.api.0x.org/swap/v1/price` +
      `?sellToken=${USDC_BASE}` +
      `&buyToken=${tokenAddress}` +
      `&sellAmount=${sellAmount}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = process.env.ZERO_X_API_KEY;
    if (apiKey) headers["0x-api-key"] = apiKey;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ...base, error: `0x ${res.status}` };
    }
    const d = (await res.json()) as any;
    // d.price is per-token USDC price; d.buyAmount is raw token units (varies by decimals)
    const priceUsd = Number(d.price) || 0;
    const impact = Number(d.estimatedPriceImpact) || 0;
    // tokens_out requires knowing buyToken decimals. 0x returns `buyTokenAddress`
    // decimals as `buyTokenDecimals` in /quote but not /price. Derive from
    // buyAmount / sellAmount instead: buyAmount / (sellAmount / 10^6) / price
    // → simpler: tokens_out = spend_usdc / price_usd (approximation with known price).
    const tokensOut = priceUsd > 0 ? spendUsdc / priceUsd : 0;
    const totalCost = spendUsdc + BASE_GAS_ESTIMATE_USD; // 0x itself has no extra fee
    const effective = tokensOut > 0 ? totalCost / tokensOut : Infinity;

    return {
      ...base,
      price_usd: priceUsd,
      price_impact_pct: impact * 100, // 0x returns 0-1, normalize to %
      tokens_out: tokensOut,
      total_cost_usd: totalCost,
      effective_price: effective,
      available: priceUsd > 0 && isFinite(effective),
    };
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }
}

/**
 * Kraken public ticker (no auth required). Only works for pairs in our
 * SUPPORTED_PAIRS map — Base memecoins won't match, so the quote is marked
 * unavailable rather than throwing.
 */
async function fetchKrakenQuote(
  symbol: string,
  spendUsdc: number
): Promise<VenueQuote> {
  const base: VenueQuote = {
    venue: "kraken",
    venue_label: "Kraken",
    price_usd: 0,
    price_impact_pct: 0,
    fee_pct: KRAKEN_TAKER_FEE_PCT,
    gas_estimate_usd: 0,
    total_cost_usd: spendUsdc,
    effective_price: 0,
    tokens_out: 0,
    available: false,
  };

  const sym = (symbol || "").toUpperCase().replace(/^\$/, "");
  if (!SUPPORTED_PAIRS.includes(sym)) {
    return { ...base, error: `Kraken doesn't list ${sym}` };
  }

  // Kraken AltName → standard symbol. Try both common forms.
  const candidates = [`${sym}USD`, `X${sym}ZUSD`];

  for (const pair of candidates) {
    try {
      const res = await fetch(
        `https://api.kraken.com/0/public/Ticker?pair=${pair}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      if (data?.error?.length) continue;
      const result = data?.result;
      if (!result) continue;
      // Kraken returns {pairName: {a: [ask, wholeLot, lotVolume], ...}}
      const firstKey = Object.keys(result)[0];
      const ticker = result[firstKey];
      const askPrice = Number(ticker?.a?.[0]);
      if (!askPrice || !isFinite(askPrice)) continue;

      const feeCost = spendUsdc * (KRAKEN_TAKER_FEE_PCT / 100);
      const effectiveSpend = spendUsdc - feeCost;
      const tokensOut = effectiveSpend / askPrice;
      const effective = tokensOut > 0 ? spendUsdc / tokensOut : Infinity;

      return {
        ...base,
        price_usd: askPrice,
        tokens_out: tokensOut,
        total_cost_usd: spendUsdc, // fee already absorbed into effective_price
        effective_price: effective,
        available: tokensOut > 0 && isFinite(effective),
      };
    } catch {
      // Try next candidate
    }
  }
  return { ...base, error: "Kraken lookup failed" };
}

// ── Assembly ──────────────────────────────────────────────────────────────

/**
 * Pure reducer: given a list of venue quotes, return best/worst/savings.
 * Extracted so tests don't need to mock venue HTTP.
 */
export function summarizeQuotes(quotes: VenueQuote[]): Omit<RouteScanResult, "expires_at"> {
  const available = quotes.filter((q) => q.available && isFinite(q.effective_price));
  if (available.length === 0) {
    return { quotes, best: null, savings_vs_worst_pct: 0 };
  }
  const sorted = available
    .slice()
    .sort((a, b) => a.effective_price - b.effective_price);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const savings =
    best && worst && worst !== best && worst.effective_price > 0
      ? ((worst.effective_price - best.effective_price) / worst.effective_price) * 100
      : 0;
  return { quotes, best, savings_vs_worst_pct: savings };
}

/**
 * Main entry: scan all venues in parallel for one token + spend amount.
 * Failed venues are represented as available:false entries in `quotes`
 * (not dropped) — the UI shows "unavailable" for them.
 */
export async function getBestPrice(
  token_address: string,
  token_symbol: string,
  spend_usdc: number
): Promise<RouteScanResult> {
  if (!(spend_usdc > 0) || spend_usdc > 10_000_000) {
    // Hard cap — a 10M USDC single-trade would be a sign of bad input.
    throw new Error("spend_usdc must be > 0 and < 10,000,000");
  }

  const [zeroX, kraken] = await Promise.allSettled([
    fetchZeroXBaseQuote(token_address, spend_usdc),
    fetchKrakenQuote(token_symbol, spend_usdc),
  ]);

  const quotes: VenueQuote[] = [
    zeroX.status === "fulfilled"
      ? zeroX.value
      : {
          venue: "0x_base",
          venue_label: "Base DEX (0x)",
          price_usd: 0,
          price_impact_pct: 0,
          fee_pct: 0,
          gas_estimate_usd: 0,
          total_cost_usd: spend_usdc,
          effective_price: 0,
          tokens_out: 0,
          available: false,
          error: (zeroX as PromiseRejectedResult).reason?.message ?? "0x error",
        },
    kraken.status === "fulfilled"
      ? kraken.value
      : {
          venue: "kraken",
          venue_label: "Kraken",
          price_usd: 0,
          price_impact_pct: 0,
          fee_pct: 0,
          gas_estimate_usd: 0,
          total_cost_usd: spend_usdc,
          effective_price: 0,
          tokens_out: 0,
          available: false,
          error: (kraken as PromiseRejectedResult).reason?.message ?? "Kraken error",
        },
  ];

  const summary = summarizeQuotes(quotes);
  const expires_at = new Date(Date.now() + QUOTE_TTL_SEC * 1000).toISOString();

  return { ...summary, expires_at };
}
