/**
 * Portfolio risk scorer.
 *
 * Computes a 0-100 risk score for a user's token balances entirely from the
 * already-loaded portfolio data — no extra API call, no server round-trip.
 *
 * Score semantics:
 *   0   = fully stablecoin, zero exposure
 *   100 = heavily concentrated in unverifiable long-tail tokens
 *
 * Per-token risk tiers (heuristic):
 *   0   stables (USDC/USDT/DAI/USDbC/cbUSDC/EURC/PYUSD)
 *   10  major L1/L2 reserves (ETH/WETH/cbETH/BTC/WBTC/cbBTC/SOL/AVAX)
 *   25  blue-chip DeFi (AAVE/UNI/LINK/MKR/COMP/LDO/AERO/BASE/CRV)
 *   50  known midcaps / meme with liquidity (PEPE/WIF/BONK/DOGE/SHIB/FLOKI/etc)
 *   80  unknown / very low liquidity
 *
 * Aggregate = USD-weighted average of per-token risk, then +20 concentration
 * penalty if any single non-stable holding exceeds 40% of the portfolio.
 *
 * Returns null when portfolio is empty or total value is zero.
 */

export type RiskBand = "green" | "yellow" | "orange" | "red";

export interface TokenRisk {
  symbol: string;
  chain: string;
  balanceUsd: number;
  weight: number; // 0-1 share of portfolio
  risk: number; // 0-100 per-token risk
}

export interface PortfolioRisk {
  score: number; // 0-100
  band: RiskBand;
  tokens: TokenRisk[];
  concentrationPenalty: number; // 0-20
  largestHoldingPct: number; // 0-100
  stableCoinPct: number; // 0-100
}

// Curated symbol lists. Kept inline — too small to warrant a separate registry.
const STABLES = new Set([
  "USDC", "USDT", "DAI", "USDBC", "CBUSDC", "USDE", "FRAX", "LUSD",
  "GHO", "EURC", "PYUSD", "TUSD", "FDUSD", "USDS", "CRVUSD",
]);

const MAJORS = new Set([
  "ETH", "WETH", "CBETH", "STETH", "WSTETH", "RETH",
  "BTC", "WBTC", "CBBTC", "TBTC",
  "SOL", "WSOL", "AVAX", "WAVAX", "BNB", "WBNB",
  "MATIC", "WMATIC", "POL",
]);

const BLUECHIPS = new Set([
  "AAVE", "UNI", "LINK", "MKR", "COMP", "LDO", "CRV", "SNX",
  "AERO", "BASE", "CAKE", "1INCH", "SUSHI", "BAL", "GMX", "YFI",
  "RNDR", "RENDER", "GRT", "FET", "ARB", "OP", "IMX", "INJ",
]);

const KNOWN_MEMES_MID = new Set([
  "PEPE", "DOGE", "SHIB", "FLOKI", "WIF", "BONK", "BRETT", "DEGEN",
  "HIGHER", "TOSHI", "MOCHI", "MOG", "NEIRO", "POPCAT", "MEW", "TRUMP",
  "MAGA", "PNUT", "FART", "CHILLGUY", "GIGA",
]);

function tierFor(symbol: string): number {
  const s = (symbol || "").toUpperCase().replace(/^\$/, "");
  if (STABLES.has(s)) return 0;
  if (MAJORS.has(s)) return 10;
  if (BLUECHIPS.has(s)) return 25;
  if (KNOWN_MEMES_MID.has(s)) return 50;
  return 80;
}

function bandFor(score: number): RiskBand {
  if (score < 25) return "green";
  if (score < 50) return "yellow";
  if (score < 75) return "orange";
  return "red";
}

export interface RiskInputToken {
  symbol: string;
  chain: string;
  balanceUsd: number;
}

/**
 * Compute portfolio risk from token balances.
 * Null when the portfolio has no valued holdings.
 */
export function computePortfolioRisk(
  tokens: RiskInputToken[]
): PortfolioRisk | null {
  const valued = (tokens || []).filter(
    (t) => t && typeof t.balanceUsd === "number" && t.balanceUsd > 0
  );
  if (valued.length === 0) return null;

  const total = valued.reduce((sum, t) => sum + t.balanceUsd, 0);
  if (total <= 0) return null;

  const rows: TokenRisk[] = valued.map((t) => {
    const weight = t.balanceUsd / total;
    return {
      symbol: t.symbol,
      chain: t.chain,
      balanceUsd: t.balanceUsd,
      weight,
      risk: tierFor(t.symbol),
    };
  });

  // USD-weighted average risk
  let weighted = 0;
  for (const r of rows) weighted += r.risk * r.weight;

  // Concentration penalty: if any single non-stable holding is > 40% of the
  // portfolio, add up to +20 points (scales linearly from 40% to 80%).
  let largest = 0;
  let concentration = 0;
  for (const r of rows) {
    if (r.risk === 0) continue; // stables don't count toward concentration
    if (r.weight > largest) largest = r.weight;
  }
  if (largest > 0.4) {
    concentration = Math.min(20, Math.round(((largest - 0.4) / 0.4) * 20));
  }

  const stablePct = rows
    .filter((r) => r.risk === 0)
    .reduce((s, r) => s + r.weight, 0) * 100;

  const score = Math.min(100, Math.round(weighted + concentration));

  return {
    score,
    band: bandFor(score),
    tokens: rows.sort((a, b) => b.balanceUsd - a.balanceUsd),
    concentrationPenalty: concentration,
    largestHoldingPct: Math.round(largest * 100),
    stableCoinPct: Math.round(stablePct),
  };
}

/** CSS-var color token for a risk band. */
export function bandColorVar(band: RiskBand): string {
  switch (band) {
    case "green": return "var(--color-green)";
    case "yellow": return "var(--color-amber)";
    case "orange": return "var(--color-orange)";
    case "red": return "var(--color-red)";
  }
}

/** Emoji indicator for a risk band. */
export function bandEmoji(band: RiskBand): string {
  switch (band) {
    case "green": return "🟢";
    case "yellow": return "🟡";
    case "orange": return "🟠";
    case "red": return "🔴";
  }
}
