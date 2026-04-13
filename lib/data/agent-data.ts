/**
 * Agent data context layer.
 * Maps each agent to its data sources and fetches the right market data
 * before passing to the AI model.
 */

import {
  extractTickers,
  getCurrentPrices,
} from "./market-data";
import { getTaapiIndicators, type TaapiIndicators } from "./taapi";
import { getFredEconomicContext, type FredEconomicContext } from "./fred";
import { getTrendingPairs, type TokenPair } from "./dexscreener";
import { getCoinPrice, getCoinMetadata, formatCoinPaprikaContext } from "./coinpaprika";
import { getDexPaprikaToken, formatDexPaprikaContext } from "./dexpaprika";
import { getBaseGasPrice, type GasData } from "./gas";
import { getYields, type YieldPool } from "../yields-cache";
import { searchToken } from "./dexscreener";
import { fetchPulseContext, formatPulseContext } from "./pulse-data";
import { fetchDevWalletData, extractAddressFromQuery } from "./dev-wallet-data";
import { buildDevCheckPrompt } from "@/lib/agents/prompts/dev-check";
import { fetchSafetyCheckData, calculateSafetyScore } from "./safety-check-data";
import { buildSafetyCheckPrompt } from "@/lib/agents/prompts/safety-check";
import { getBotPerformanceContext } from "./bot-performance";
import {
  extractTokenRef,
  resolveTokenDataSource,
  formatDexScreenerContext,
  type TokenRoutingResult,
} from "./token-router";

// ── Types ──

export interface BtcMarketContext {
  price: number;
  rsi: number;
  macdHistogram: number;
  trend: string;         // "bullish" | "bearish" | "neutral"
  ema50: number | null;
  ema200: number | null;
  change24h: number;
  safeForAlts: boolean;  // false if BTC is crashing
  flashCrash: boolean;   // true if >5% drop in candle
}

export interface AgentDataContext {
  prices?: Record<string, number>;
  taapiIndicators?: TaapiIndicators;
  btcContext?: BtcMarketContext;
  fredEconomic?: FredEconomicContext;
  trending?: TokenPair[];
  coinPaprika?: string;
  dexPaprika?: string;
  gas?: GasData;
  yields?: YieldPool[];
  dexScreenerSecurity?: string;
  portfolioContext?: string;
  pulseContext?: string;
  devCheckContext?: string;
  safetyCheckContext?: string;
  botPerformance?: string;
  // ── Token routing (populated by lib/data/token-router.ts) ──
  /** The token the user asked about (canonical symbol or address). */
  targetToken?: string;
  /** Where the data came from (taapi_cex, dexscreener, on_chain, unknown). */
  tokenRouting?: TokenRoutingResult;
  /** Formatted DexScreener block for prompts (non-CEX tokens). */
  dexScreenerData?: string;
  /** True if the target token has no CEX indicators — agents must not invent RSI/MACD. */
  taapiUnavailable?: boolean;
}

// ── BTC Market Context — always fetched for analysis agents ──
// Mirrors the Python bot's _fetch_btc_data() pattern from analyst.py

async function fetchBtcContext(): Promise<BtcMarketContext | null> {
  try {
    const btc = await getTaapiIndicators("BTC/USD", "1h");
    if (!btc.candle || btc.rsi === null) return null;

    const price = btc.candle.close;
    const change24h = btc.candle.open > 0
      ? ((price - btc.candle.open) / btc.candle.open) * 100
      : 0;

    // Determine trend
    let trend = "neutral";
    if (btc.ema50 !== null && btc.ema200 !== null) {
      trend = btc.ema50 > btc.ema200 ? "bullish" : "bearish";
    } else if (btc.rsi > 60) {
      trend = "bullish";
    } else if (btc.rsi < 40) {
      trend = "bearish";
    }

    // Flash crash: >5% drop in current candle
    const flashCrash = change24h < -5;

    // Safe for alts: BTC not crashing AND not deeply overbought with reversal signs
    const safeForAlts = !flashCrash && btc.rsi > 25 && change24h > -3;

    return {
      price,
      rsi: btc.rsi,
      macdHistogram: btc.macd?.histogram ?? 0,
      trend,
      ema50: btc.ema50,
      ema200: btc.ema200,
      change24h,
      safeForAlts,
      flashCrash,
    };
  } catch {
    return null;
  }
}

// ── Shared routing helper ──
// Every agent that wants price/technical data for "the token the user asked
// about" goes through this. It NEVER falls back to an unrelated token.

interface RoutedTokenContext {
  targetToken: string | null;
  routing: TokenRoutingResult | null;
  /** TAAPI indicators if the token is on CEX, otherwise null. */
  taapiIndicators: TaapiIndicators | null;
  /** Formatted DexScreener block if source is DEX, otherwise undefined. */
  dexScreenerData: string | undefined;
  /** True if no CEX indicators are available for the target token. */
  taapiUnavailable: boolean;
}

async function routeTokenForMessage(
  message: string,
  interval: string = "1h"
): Promise<RoutedTokenContext> {
  const ref = extractTokenRef(message);
  if (!ref) {
    return {
      targetToken: null,
      routing: null,
      taapiIndicators: null,
      dexScreenerData: undefined,
      taapiUnavailable: true,
    };
  }

  const routing = await resolveTokenDataSource(ref);
  let taapiIndicators: TaapiIndicators | null = null;
  let dexScreenerData: string | undefined;

  if (routing.source === "taapi_cex" && routing.cex_pair) {
    taapiIndicators = await getTaapiIndicators(routing.cex_pair, interval).catch(
      () => null
    );
  } else if (routing.source === "dexscreener" && routing.pair) {
    dexScreenerData = formatDexScreenerContext(routing.pair, routing.symbol);
  }

  return {
    targetToken: routing.symbol || ref,
    routing,
    taapiIndicators,
    dexScreenerData,
    taapiUnavailable: !routing.has_cex_data || !taapiIndicators?.candle,
  };
}

/**
 * Merge a RoutedTokenContext into an AgentDataContext.
 * Sets targetToken, tokenRouting, dexScreenerData, taapiUnavailable, and
 * conditionally taapiIndicators (only when they actually exist).
 */
function applyRouting(
  ctx: AgentDataContext,
  routed: RoutedTokenContext
): AgentDataContext {
  if (routed.targetToken) ctx.targetToken = routed.targetToken;
  if (routed.routing) ctx.tokenRouting = routed.routing;
  if (routed.dexScreenerData) ctx.dexScreenerData = routed.dexScreenerData;
  if (routed.taapiIndicators && routed.taapiIndicators.candle) {
    ctx.taapiIndicators = routed.taapiIndicators;
  }
  ctx.taapiUnavailable = routed.taapiUnavailable;
  return ctx;
}

// ── Agent → Data Source Map ──

type DataFetcher = (message: string) => Promise<AgentDataContext>;

const AGENT_DATA_MAP: Record<string, DataFetcher> = {
  "claudia-defi-101": async (message) => {
    const tickers = extractTickers(message);
    const [prices, fredEconomic] = await Promise.all([
      getCurrentPrices(tickers),
      getFredEconomicContext(),
    ]);
    return { prices, fredEconomic };
  },

  "claudia-yield-scout": async (message) => {
    const tickers = extractTickers(message);
    const mainTicker = tickers[0] || "ETH/USD";
    const [prices, fredEconomic, yields, indicators] = await Promise.all([
      getCurrentPrices(["ETH/USD", "BTC/USD", ...tickers]),
      getFredEconomicContext(),
      getYields().catch(() => []),
      getTaapiIndicators(mainTicker, "1d").catch(() => null),
    ]);
    return { prices, fredEconomic, yields: yields.slice(0, 15), ...(indicators && { taapiIndicators: indicators }) };
  },

  "claudia-gas-guru": async () => {
    const [prices, gas] = await Promise.all([
      getCurrentPrices(["ETH/USD"]),
      getBaseGasPrice().catch(() => null),
    ]);
    return { prices, ...(gas && { gas }) };
  },

  "claudia-chart-reader": async (message) => {
    const routed = await routeTokenForMessage(message, "1h");
    const tickers = extractTickers(message);
    // BTC context is the market regime reference — fetched UNLESS the user
    // is asking about BTC itself. Never conflated with the target token.
    const isBtcTarget = routed.routing?.symbol === "BTC";
    const [prices, btcCtx, botPerf] = await Promise.all([
      tickers.length > 0 ? getCurrentPrices(tickers) : Promise.resolve({}),
      isBtcTarget ? Promise.resolve(null) : fetchBtcContext(),
      getBotPerformanceContext(message).catch(() => null),
    ]);
    const ctx: AgentDataContext = {
      prices,
      ...(btcCtx && { btcContext: btcCtx }),
      ...(botPerf && { botPerformance: botPerf }),
    };
    return applyRouting(ctx, routed);
  },

  "claudia-risk-check": async (message) => {
    const routed = await routeTokenForMessage(message, "1h");
    const tickers = extractTickers(message);
    const isBtcTarget = routed.routing?.symbol === "BTC";
    const [prices, fredEconomic, btcCtx, botPerf] = await Promise.all([
      tickers.length > 0 ? getCurrentPrices(tickers) : Promise.resolve({}),
      getFredEconomicContext(),
      isBtcTarget ? Promise.resolve(null) : fetchBtcContext(),
      getBotPerformanceContext(message).catch(() => null),
    ]);
    const ctx: AgentDataContext = {
      prices,
      fredEconomic,
      ...(btcCtx && { btcContext: btcCtx }),
      ...(botPerf && { botPerformance: botPerf }),
    };
    return applyRouting(ctx, routed);
  },

  "claudia-token-analyst": async (message) => {
    const routed = await routeTokenForMessage(message, "1h");
    const tickers = extractTickers(message);
    const isBtcTarget = routed.routing?.symbol === "BTC";
    const [prices, btcCtx, botPerf] = await Promise.all([
      tickers.length > 0 ? getCurrentPrices(tickers) : Promise.resolve({}),
      isBtcTarget ? Promise.resolve(null) : fetchBtcContext(),
      getBotPerformanceContext(message).catch(() => null),
    ]);

    // Supplement with CoinPaprika fundamentals — only for CEX-listed tokens.
    // For DEX-only tokens CoinPaprika usually has no record; skip silently.
    let coinPaprika: string | undefined;
    if (routed.routing?.has_cex_data && routed.routing.symbol) {
      const [cpPrice, cpMeta] = await Promise.allSettled([
        getCoinPrice(routed.routing.symbol),
        getCoinMetadata(routed.routing.symbol),
      ]);
      const formatted = formatCoinPaprikaContext(
        cpPrice.status === "fulfilled" ? cpPrice.value : null,
        cpMeta.status === "fulfilled" ? cpMeta.value : null
      );
      if (formatted) coinPaprika = formatted;
    }

    // For DEX tokens pulled by address, DexPaprika adds on-chain depth/tx data
    let dexPaprika: string | undefined;
    if (routed.routing?.source === "dexscreener" && routed.routing.token_address) {
      const dexData = await getDexPaprikaToken(routed.routing.token_address).catch(() => null);
      const formatted = formatDexPaprikaContext(dexData);
      if (formatted) dexPaprika = formatted;
    }

    const ctx: AgentDataContext = {
      prices,
      ...(btcCtx && { btcContext: btcCtx }),
      ...(coinPaprika && { coinPaprika }),
      ...(dexPaprika && { dexPaprika }),
      ...(botPerf && { botPerformance: botPerf }),
    };
    return applyRouting(ctx, routed);
  },

  "claudia-memecoin-radar": async (message) => {
    // Memecoin radar: if user names a specific token, route it; otherwise
    // just return trending pairs + BTC regime with no forced TAAPI call.
    const routed = await routeTokenForMessage(message, "1h");
    const tickers = extractTickers(message);
    const [prices, trending, btcCtx] = await Promise.all([
      tickers.length > 0 ? getCurrentPrices(tickers) : Promise.resolve({}),
      getTrendingPairs("base", 15),
      fetchBtcContext(),
    ]);

    // DexPaprika for on-chain DEX data when a contract address is provided.
    // Prefer the routed token_address (already normalized) over a raw match.
    let dexPaprika: string | undefined;
    const addr = routed.routing?.token_address || message.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (addr) {
      const dexData = await getDexPaprikaToken(addr).catch(() => null);
      const formatted = formatDexPaprikaContext(dexData);
      if (formatted) dexPaprika = formatted;
    }

    const ctx: AgentDataContext = {
      prices,
      trending,
      ...(btcCtx && { btcContext: btcCtx }),
      ...(dexPaprika && { dexPaprika }),
    };
    // Only apply routing if the user actually named a token — otherwise the
    // radar is in "discover trending" mode and target/unavailable flags would
    // be noisy.
    if (routed.targetToken) applyRouting(ctx, routed);
    return ctx;
  },

  "claudia-base-guide": async () => {
    return {
      prices: await getCurrentPrices(["ETH/USD"]),
      trending: await getTrendingPairs("base", 10),
    };
  },

  "claudia-pulse": async (message) => {
    const pulse = await fetchPulseContext(message);
    return { prices: pulse.prices, pulseContext: formatPulseContext(pulse) };
  },

  "claudia-dev-check": async (message) => {
    const address = extractAddressFromQuery(message);
    if (!address) {
      return { devCheckContext: "No wallet or contract address found in query. Ask the user to provide a 0x address." };
    }
    const data = await fetchDevWalletData(address);
    return { devCheckContext: buildDevCheckPrompt(data) };
  },

  "claudia-safety-check": async (message) => {
    const address = extractAddressFromQuery(message);
    if (!address) {
      return { safetyCheckContext: "Paste a contract address to check. Format: 0x..." };
    }
    const data = await fetchSafetyCheckData(address);
    const result = calculateSafetyScore(data);
    return { safetyCheckContext: buildSafetyCheckPrompt(data, result) };
  },

  "claudia-security-check": async (message) => {
    const routed = await routeTokenForMessage(message, "1h");
    const isBtcTarget = routed.routing?.symbol === "BTC";

    const [btcCtx, botPerf] = await Promise.all([
      isBtcTarget ? Promise.resolve(null) : fetchBtcContext(),
      getBotPerformanceContext(message).catch(() => null),
    ]);

    // CoinPaprika metadata — only meaningful for CEX-listed tokens
    let coinPaprika: string | undefined;
    if (routed.routing?.has_cex_data && routed.routing.symbol) {
      const cpMeta = await getCoinMetadata(routed.routing.symbol).catch(() => null);
      const formatted = formatCoinPaprikaContext(null, cpMeta);
      if (formatted) coinPaprika = formatted;
    }

    // Additional DEX security snapshot (buy/sell ratio, liquidity depth)
    // Routing already returns the best pair — reuse it instead of re-searching.
    let dexScreenerSecurity: string | undefined;
    if (routed.routing?.pair) {
      const p = routed.routing.pair;
      const pct = (v: number | null | undefined) =>
        v != null && !isNaN(v as number) ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "?";
      dexScreenerSecurity = [
        "DEXSCREENER SECURITY DATA:",
        `Pair: ${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
        `Price: $${p.priceUsd}`,
        `Liquidity: $${p.liquidity?.usd?.toLocaleString() || "unknown"}`,
        `24h Volume: $${p.volume?.h24?.toLocaleString() || "unknown"}`,
        `24h Buys: ${p.txns?.h24?.buys || 0} / Sells: ${p.txns?.h24?.sells || 0}`,
        `24h Change: ${pct(p.priceChange?.h24)}`,
      ].join("\n");
    }

    const ctx: AgentDataContext = {
      ...(btcCtx && { btcContext: btcCtx }),
      ...(coinPaprika && { coinPaprika }),
      ...(dexScreenerSecurity && { dexScreenerSecurity }),
      ...(botPerf && { botPerformance: botPerf }),
    };
    return applyRouting(ctx, routed);
  },

  "claudia-bot-performance": async (message) => {
    const botPerf = await getBotPerformanceContext(message).catch(() => null);
    return {
      ...(botPerf && { botPerformance: botPerf }),
    };
  },
};

// ── Default fetcher for unknown/user-created agents ──

const defaultFetcher: DataFetcher = async (message) => {
  const tickers = extractTickers(message);
  return {
    prices: await getCurrentPrices(tickers),
  };
};

/**
 * Fetch the right market data context for an agent based on its ID.
 * Returns structured data that gets formatted into the AI prompt.
 * Errors are swallowed — missing data shouldn't block the chat.
 */
export async function fetchAgentContext(
  agentId: string,
  userMessage: string
): Promise<AgentDataContext> {
  const fetcher = AGENT_DATA_MAP[agentId] || defaultFetcher;
  try {
    return await fetcher(userMessage);
  } catch (err) {
    console.error(`Agent context fetch failed for ${agentId}:`, (err as Error).message);
    return {};
  }
}
