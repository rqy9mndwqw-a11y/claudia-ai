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
    const tickers = extractTickers(message);
    const mainTicker = tickers[0] || "BTC/USD";
    const isBtc = mainTicker === "BTC/USD";
    const [prices, indicators, btcCtx] = await Promise.all([
      getCurrentPrices(tickers),
      getTaapiIndicators(mainTicker, "1h").catch(() => null),
      isBtc ? Promise.resolve(null) : fetchBtcContext(),
    ]);
    return {
      prices,
      ...(indicators && { taapiIndicators: indicators }),
      ...(btcCtx && { btcContext: btcCtx }),
    };
  },

  "claudia-risk-check": async (message) => {
    const tickers = extractTickers(message);
    const mainTicker = tickers[0] || "BTC/USD";
    const isBtc = mainTicker === "BTC/USD";
    const [prices, indicators, fredEconomic, btcCtx] = await Promise.all([
      getCurrentPrices(tickers),
      getTaapiIndicators(mainTicker, "1h").catch(() => null),
      getFredEconomicContext(),
      isBtc ? Promise.resolve(null) : fetchBtcContext(),
    ]);
    return {
      prices,
      ...(indicators && { taapiIndicators: indicators }),
      ...(btcCtx && { btcContext: btcCtx }),
      fredEconomic,
    };
  },

  "claudia-token-analyst": async (message) => {
    const tickers = extractTickers(message);
    const mainTicker = tickers[0] || "BTC/USD";
    const isBtc = mainTicker === "BTC/USD";
    const [prices, indicators, btcCtx] = await Promise.all([
      getCurrentPrices(tickers),
      getTaapiIndicators(mainTicker, "1h").catch(() => null),
      isBtc ? Promise.resolve(null) : fetchBtcContext(),
    ]);

    // Supplement with CoinPaprika fundamentals (market cap, supply, team, beta)
    let coinPaprika: string | undefined;
    if (tickers.length > 0) {
      const mainSymbol = tickers[0].split("/")[0];
      const [cpPrice, cpMeta] = await Promise.allSettled([
        getCoinPrice(mainSymbol),
        getCoinMetadata(mainSymbol),
      ]);
      const formatted = formatCoinPaprikaContext(
        cpPrice.status === "fulfilled" ? cpPrice.value : null,
        cpMeta.status === "fulfilled" ? cpMeta.value : null
      );
      if (formatted) coinPaprika = formatted;
    }

    return {
      prices,
      ...(indicators && { taapiIndicators: indicators }),
      ...(btcCtx && { btcContext: btcCtx }),
      ...(coinPaprika && { coinPaprika }),
    };
  },

  "claudia-memecoin-radar": async (message) => {
    const tickers = extractTickers(message);
    const mainTicker = tickers[0] || "DOGE/USD";
    const [prices, trending, indicators, btcCtx] = await Promise.all([
      getCurrentPrices(tickers),
      getTrendingPairs("base", 15),
      getTaapiIndicators(mainTicker, "1h").catch(() => null),
      fetchBtcContext(),
    ]);

    // DexPaprika for on-chain DEX data when a contract address is provided
    let dexPaprika: string | undefined;
    const contractMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (contractMatch) {
      const dexData = await getDexPaprikaToken(contractMatch[0]).catch(() => null);
      const formatted = formatDexPaprikaContext(dexData);
      if (formatted) dexPaprika = formatted;
    }

    return { prices, trending, ...(indicators && { taapiIndicators: indicators }), ...(btcCtx && { btcContext: btcCtx }), ...(dexPaprika && { dexPaprika }) };
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

  "claudia-security-check": async (message) => {
    const tickers = extractTickers(message);
    let coinPaprika: string | undefined;
    let dexScreenerSecurity: string | undefined;
    const mainTicker = tickers.length > 0 ? tickers[0].split("/")[0] : null;
    const mainPair = tickers[0] || "BTC/USD";

    // TAAPI for price/volume/momentum data + BTC market context
    const isBtc = mainPair === "BTC/USD";
    const [indicators, btcCtx] = await Promise.all([
      getTaapiIndicators(mainPair, "1h").catch(() => null),
      isBtc ? Promise.resolve(null) : fetchBtcContext(),
    ]);

    if (mainTicker) {
      const [cpMeta, dexPairs] = await Promise.allSettled([
        getCoinMetadata(mainTicker),
        searchToken(mainTicker),
      ]);

      if (cpMeta.status === "fulfilled" && cpMeta.value) {
        const formatted = formatCoinPaprikaContext(null, cpMeta.value);
        if (formatted) coinPaprika = formatted;
      }

      if (dexPairs.status === "fulfilled" && dexPairs.value.length > 0) {
        const pair = dexPairs.value[0];
        const lines = [
          "DEXSCREENER SECURITY DATA:",
          `Pair: ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`,
          `Price: $${pair.priceUsd}`,
          `Liquidity: $${pair.liquidity?.usd?.toLocaleString() || "unknown"}`,
          `24h Volume: $${pair.volume?.h24?.toLocaleString() || "unknown"}`,
          `24h Buys: ${pair.txns?.h24?.buys || 0} / Sells: ${pair.txns?.h24?.sells || 0}`,
          `24h Change: ${pair.priceChange?.h24 >= 0 ? "+" : ""}${pair.priceChange?.h24?.toFixed(1) || "?"}%`,
        ];
        dexScreenerSecurity = lines.join("\n");
      }
    }

    return {
      ...(indicators && { taapiIndicators: indicators }),
      ...(btcCtx && { btcContext: btcCtx }),
      ...(coinPaprika && { coinPaprika }),
      ...(dexScreenerSecurity && { dexScreenerSecurity }),
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
