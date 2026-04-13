/**
 * Token data source router.
 *
 * Core job: given a user's token reference (symbol OR contract address),
 * decide whether TAAPI (CEX indicators), DexScreener (DEX price/liq), or
 * on-chain is the right data source — and NEVER fall back to a different
 * token's data (e.g. pulling BTC technicals when the user asked about TN100X).
 *
 * Consumers: lib/data/agent-data.ts, app/api/agents/full-analysis/route.ts
 */

import { searchToken, type TokenPair } from "./dexscreener";

export type TokenDataSource = "taapi_cex" | "dexscreener" | "on_chain" | "unknown";

export interface TokenRoutingResult {
  source: TokenDataSource;
  /** Canonical symbol (uppercase, no $ or /USD). */
  symbol?: string;
  /** TAAPI pair string when source === "taapi_cex", e.g. "BTC/USD". */
  cex_pair?: string;
  /** ERC-20 contract address (lowercase) when known. */
  token_address?: string;
  /** DEX pair contract address when source === "dexscreener". */
  pair_address?: string;
  /** Chain id from DexScreener (e.g. "base", "ethereum"). */
  chain?: string;
  /** True if TAAPI can provide indicators for this token. */
  has_cex_data: boolean;
  /** True if DexScreener has liquidity data for this token. */
  has_dex_data: boolean;
  /** The DexScreener pair object (highest-liquidity match). */
  pair?: TokenPair;
}

/**
 * Symbols we know Binance lists (TAAPI's default exchange).
 * Non-exhaustive but covers every ticker the scanner scans plus common alts.
 * Keep in sync with lib/scanner/market-scanner.ts CORE_PAIRS + EXTENDED_PAIRS.
 */
const CEX_SUPPORTED_SYMBOLS = new Set([
  // Top caps
  "BTC", "ETH", "XRP", "SOL", "BNB", "ADA", "AVAX", "DOGE", "DOT", "LINK",
  "MATIC", "POL", "LTC", "BCH", "ATOM", "TRX", "NEAR", "FIL", "ICP", "APT",
  "ARB", "OP", "SUI", "INJ", "SEI", "TIA", "TON", "TAO", "HBAR", "ALGO",
  "VET", "XLM", "ETC", "XMR", "ZEC", "KAS", "MANTA",
  // DeFi
  "UNI", "AAVE", "MKR", "CRV", "SNX", "COMP", "LDO", "PENDLE", "ENA", "JUP",
  "BAT", "STX", "RUNE",
  // AI / data
  "FET", "RENDER", "RNDR", "GRT", "ONDO", "WLD", "AKT", "AR", "OCEAN", "AGIX",
  // Gaming / meta
  "IMX", "STRK", "MANA", "SAND", "AXS", "ENJ", "CHZ", "GALA", "APE",
  // Memes
  "PEPE", "SHIB", "DOGE", "WIF", "BONK", "FLOKI", "DEGEN", "MEME", "NOT",
  // Layer-2 / new
  "JTO", "PYTH", "W", "ETHFI", "STETH", "WBTC",
]);

/** Matches a 0x-prefixed 40-hex-char address. */
function isContractAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

/** Normalize a symbol reference like "$claudia" or "CLAUDIA/USD" → "CLAUDIA". */
function normalizeSymbol(input: string): string {
  return input.trim().replace(/^\$/, "").replace(/\/USD.*$/i, "").toUpperCase();
}

/**
 * Extract the primary token reference from a free-text user message.
 * Returns either an address, a symbol, or null. Never defaults to BTC.
 */
export function extractTokenRef(message: string): string | null {
  if (!message) return null;

  // 1) Contract address wins — always unambiguous
  const addrMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (addrMatch) return addrMatch[0];

  // 2) Explicit $TICKER / TICKER/USD
  const upper = message.toUpperCase();
  const dollarMatch = upper.match(/\$([A-Z][A-Z0-9]{1,9})\b/);
  if (dollarMatch) return dollarMatch[1];

  const pairMatch = upper.match(/\b([A-Z][A-Z0-9]{1,9})\/USD[T]?\b/);
  if (pairMatch) return pairMatch[1];

  // 3) Bare uppercase word that's a known CEX symbol
  const words = upper.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) || [];
  for (const w of words) {
    if (CEX_SUPPORTED_SYMBOLS.has(w)) return w;
  }

  // 4) Any remaining uppercase word 3-10 chars, skipping common English words
  const STOP = new Set([
    "THE", "AND", "FOR", "ARE", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
    "ONE", "OUR", "OUT", "HAS", "HIS", "HOW", "ITS", "MAY", "NEW", "NOW",
    "OLD", "SEE", "WAY", "WHO", "DID", "GET", "HIM", "LET", "SAY", "SHE",
    "TOO", "USE", "WHAT", "WHEN", "WHY", "WILL", "WITH", "FULL", "THIS",
    "THAT", "FROM", "INTO", "OVER", "THEY", "THEM", "THEN", "ANALYSIS",
    "ANALYZE", "ABOUT", "PRICE", "TOKEN", "COIN", "MARKET", "TELL", "GIVE",
    "SHOW", "CHECK", "LOOK", "THINK", "SHOULD", "WOULD", "BUY", "SELL",
    "HOLD", "LONG", "SHORT", "RISK", "CHART", "RSI", "MACD", "EMA", "USD",
    "USDT", "USDC", "TVL", "APY", "DEX", "CEX", "DEFI", "DAO", "NFT",
    "MARKETS", "TOKENS", "COINS", "PRICES", "TRADING", "CRYPTO",
  ]);
  for (const w of words) {
    if (!STOP.has(w) && w.length >= 3 && w.length <= 10) return w;
  }

  return null;
}

/**
 * Resolve where to fetch data for a token reference (symbol or address).
 *
 * Policy:
 *   - Known CEX symbol → source: "taapi_cex" (no DexScreener call)
 *   - Contract address → DexScreener search; if found, source: "dexscreener";
 *     else source: "on_chain"
 *   - Unknown symbol → DexScreener search; if exact baseToken.symbol match,
 *     source: "dexscreener"; else source: "unknown"
 *
 * NEVER falls back to an unrelated token. If nothing resolves, has_cex_data
 * and has_dex_data are both false and the caller must render a "no data" note.
 */
export async function resolveTokenDataSource(
  token: string
): Promise<TokenRoutingResult> {
  const raw = (token || "").trim();
  if (!raw) {
    return { source: "unknown", has_cex_data: false, has_dex_data: false };
  }

  // ── Contract address branch ──
  if (isContractAddress(raw)) {
    const addr = raw.toLowerCase();
    try {
      const pairs = await searchToken(addr);
      const matches = pairs.filter(
        (p) => (p.baseToken?.address || "").toLowerCase() === addr
      );
      if (matches.length > 0) {
        const best = matches
          .slice()
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        const sym = (best.baseToken?.symbol || "").toUpperCase();
        return {
          source: "dexscreener",
          symbol: sym || undefined,
          token_address: addr,
          pair_address: best.pairAddress,
          chain: (best as any).chainId,
          has_cex_data: sym ? CEX_SUPPORTED_SYMBOLS.has(sym) : false,
          has_dex_data: true,
          pair: best,
        };
      }
    } catch {
      // DexScreener unavailable — fall through to on_chain
    }
    return {
      source: "on_chain",
      token_address: addr,
      has_cex_data: false,
      has_dex_data: false,
    };
  }

  // ── Symbol branch ──
  const sym = normalizeSymbol(raw);
  if (!sym) {
    return { source: "unknown", has_cex_data: false, has_dex_data: false };
  }

  if (CEX_SUPPORTED_SYMBOLS.has(sym)) {
    return {
      source: "taapi_cex",
      symbol: sym,
      cex_pair: `${sym}/USD`,
      has_cex_data: true,
      has_dex_data: false,
    };
  }

  // Unknown symbol — DexScreener lookup with strict baseToken symbol match
  try {
    const pairs = await searchToken(sym);
    const matches = pairs.filter(
      (p) => (p.baseToken?.symbol || "").toUpperCase() === sym
    );
    if (matches.length > 0) {
      const best = matches
        .slice()
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      return {
        source: "dexscreener",
        symbol: sym,
        token_address: (best.baseToken?.address || "").toLowerCase() || undefined,
        pair_address: best.pairAddress,
        chain: (best as any).chainId,
        has_cex_data: false,
        has_dex_data: true,
        pair: best,
      };
    }
  } catch {
    // DexScreener unavailable
  }

  return {
    source: "unknown",
    symbol: sym,
    has_cex_data: false,
    has_dex_data: false,
  };
}

/**
 * Format a DexScreener pair into a text block for AI prompt injection.
 * Mirrors the structure of formatTaapiContext so agents see a labeled block.
 */
export function formatDexScreenerContext(
  pair: TokenPair,
  symbol?: string
): string {
  const sym = (symbol || pair.baseToken?.symbol || "???").toUpperCase();
  const priceChange = pair.priceChange || ({} as any);
  const txns = pair.txns?.h24 || { buys: 0, sells: 0 };
  const fdv = (pair as any).fdv;
  const pairCreatedAt = (pair as any).pairCreatedAt;
  const chain = ((pair as any).chainId || "base").toUpperCase();

  const ageDays =
    pairCreatedAt && Number(pairCreatedAt) > 0
      ? Math.floor((Date.now() - Number(pairCreatedAt)) / 86_400_000)
      : null;

  const pct = (v: number | null | undefined): string => {
    if (v == null || typeof v !== "number" || isNaN(v)) return "?";
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  };

  const lines: string[] = [
    `DEX MARKET DATA (${sym} on ${chain}):`,
    `Price: $${pair.priceUsd ?? "?"}`,
    `Change: 1h ${pct(priceChange.h1)} | 6h ${pct(priceChange.h6)} | 24h ${pct(priceChange.h24)}`,
    `24h Volume: $${pair.volume?.h24?.toLocaleString() ?? "?"}`,
    `Liquidity: $${pair.liquidity?.usd?.toLocaleString() ?? "?"}`,
  ];
  if (fdv) lines.push(`FDV: $${Number(fdv).toLocaleString()}`);
  lines.push(`24h Buys / Sells: ${txns.buys ?? 0} / ${txns.sells ?? 0}`);
  if (ageDays !== null) lines.push(`Pair Age: ${ageDays} days`);
  if (pair.pairAddress) lines.push(`Pair: ${pair.pairAddress}`);
  return lines.join("\n");
}
