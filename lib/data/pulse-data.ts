/**
 * Pulse data — social sentiment signals from existing data sources.
 * Uses DexScreener (volume spikes, buy/sell ratios, trending pairs)
 * and CoinPaprika (social links, community metrics) as sentiment proxies.
 * No new paid APIs — built on what we already have.
 */

import { searchToken, type TokenPair } from "./dexscreener";
import { getCoinPrice, getCoinMetadata } from "./coinpaprika";
import { getCurrentPrices, extractTickers } from "./market-data";
import { withCache } from "./market-data";

export interface PulseContext {
  trending: TokenPair[];
  sentimentSignals: SentimentSignal[];
  prices: Record<string, number>;
  coinMeta?: string;
}

export interface SentimentSignal {
  symbol: string;
  signal: string;
  strength: "strong" | "moderate" | "weak";
  direction: "bullish" | "bearish" | "neutral";
}

/**
 * Analyze buy/sell ratio and volume to derive sentiment signals.
 */
function deriveSentimentFromPairs(pairs: TokenPair[]): SentimentSignal[] {
  const signals: SentimentSignal[] = [];

  for (const pair of pairs.slice(0, 15)) {
    const sym = pair.baseToken?.symbol || "???";
    const buys = pair.txns?.h24?.buys || 0;
    const sells = pair.txns?.h24?.sells || 0;
    const totalTxns = buys + sells;
    if (totalTxns < 10) continue;

    const buyRatio = buys / totalTxns;
    const change24h = pair.priceChange?.h24 ?? 0;
    const change1h = pair.priceChange?.h1 ?? 0;

    // Strong bullish: >65% buys + positive price action
    if (buyRatio > 0.65 && change24h > 5) {
      signals.push({
        symbol: sym,
        signal: `${(buyRatio * 100).toFixed(0)}% buy pressure, +${change24h.toFixed(1)}% 24h`,
        strength: buyRatio > 0.75 ? "strong" : "moderate",
        direction: "bullish",
      });
    }
    // Strong bearish: >65% sells + negative price action
    else if (buyRatio < 0.35 && change24h < -5) {
      signals.push({
        symbol: sym,
        signal: `${((1 - buyRatio) * 100).toFixed(0)}% sell pressure, ${change24h.toFixed(1)}% 24h`,
        strength: buyRatio < 0.25 ? "strong" : "moderate",
        direction: "bearish",
      });
    }
    // Sudden momentum shift: 1h change > 10%
    else if (Math.abs(change1h) > 10) {
      signals.push({
        symbol: sym,
        signal: `${change1h > 0 ? "+" : ""}${change1h.toFixed(1)}% in last hour — momentum spike`,
        strength: Math.abs(change1h) > 20 ? "strong" : "moderate",
        direction: change1h > 0 ? "bullish" : "bearish",
      });
    }
    // Volume anomaly: high txn count with flat price = accumulation or distribution
    else if (totalTxns > 500 && Math.abs(change24h) < 3) {
      signals.push({
        symbol: sym,
        signal: `${totalTxns} txns but flat price — ${buyRatio > 0.5 ? "possible accumulation" : "possible distribution"}`,
        strength: "weak",
        direction: buyRatio > 0.55 ? "bullish" : buyRatio < 0.45 ? "bearish" : "neutral",
      });
    }
  }

  return signals;
}

/**
 * Fetch all pulse context data in parallel.
 */
export async function fetchPulseContext(message: string): Promise<PulseContext> {
  const tickers = extractTickers(message);
  const mainSymbol = tickers[0]?.split("/")[0];

  const [prices, trending, coinMeta] = await Promise.all([
    getCurrentPrices(tickers.length > 0 ? tickers : ["BTC/USD", "ETH/USD", "SOL/USD"]).catch(() => ({})),
    // DexScreener trending on Base — our best social signal proxy
    withCache("pulse:trending", 120, async () => {
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/search?q=WETH%20base",
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.pairs || [])
          .filter((p: any) => p.chainId === "base" && p.liquidity?.usd > 50000)
          .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
          .slice(0, 20) as TokenPair[];
      } catch { return []; }
    }),
    // CoinPaprika metadata for the main token if mentioned
    mainSymbol
      ? getCoinMetadata(mainSymbol).catch(() => null)
      : Promise.resolve(null),
  ]);

  const sentimentSignals = deriveSentimentFromPairs(trending);

  // Format CoinPaprika social data if available
  let coinMetaStr: string | undefined;
  if (coinMeta) {
    const parts: string[] = [];
    if ((coinMeta as any).name) parts.push(`Token: ${(coinMeta as any).name}`);
    if ((coinMeta as any).description) parts.push(`About: ${String((coinMeta as any).description).slice(0, 200)}`);
    if ((coinMeta as any).links) {
      const links = (coinMeta as any).links;
      if (links.twitter?.length) parts.push(`Twitter: ${links.twitter[0]}`);
      if (links.reddit?.length) parts.push(`Reddit: ${links.reddit[0]}`);
    }
    if ((coinMeta as any).tags?.length) parts.push(`Tags: ${(coinMeta as any).tags.slice(0, 5).join(", ")}`);
    if (parts.length > 0) coinMetaStr = parts.join("\n");
  }

  return { trending, sentimentSignals, prices, coinMeta: coinMetaStr };
}

/**
 * Format pulse context into a prompt-ready string.
 */
export function formatPulseContext(ctx: PulseContext): string {
  const sections: string[] = [];

  // Sentiment signals
  if (ctx.sentimentSignals.length > 0) {
    const lines = ["SOCIAL SENTIMENT SIGNALS (derived from on-chain activity):"];
    for (const sig of ctx.sentimentSignals) {
      const arrow = sig.direction === "bullish" ? "↑" : sig.direction === "bearish" ? "↓" : "→";
      const strength = sig.strength === "strong" ? "🔥" : sig.strength === "moderate" ? "⚡" : "💤";
      lines.push(`${strength} ${sig.symbol} ${arrow} ${sig.signal} [${sig.strength} ${sig.direction}]`);
    }
    sections.push(lines.join("\n"));
  }

  // Trending pairs (volume-ranked = social attention proxy)
  if (ctx.trending.length > 0) {
    const lines = ["TRENDING ON BASE (volume = social attention):"];
    for (const pair of ctx.trending.slice(0, 10)) {
      const sym = pair.baseToken?.symbol || "???";
      const price = pair.priceUsd ? `$${Number(pair.priceUsd).toFixed(6)}` : "N/A";
      const change = pair.priceChange?.h24 != null ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24.toFixed(1)}%` : "";
      const vol = pair.volume?.h24 ? `$${(pair.volume.h24 / 1e6).toFixed(1)}M` : "";
      const buys = pair.txns?.h24?.buys || 0;
      const sells = pair.txns?.h24?.sells || 0;
      const ratio = buys + sells > 0 ? `${((buys / (buys + sells)) * 100).toFixed(0)}% buy` : "";
      lines.push(`${sym}: ${price} ${change} | Vol: ${vol} | ${buys}B/${sells}S (${ratio})`);
    }
    sections.push(lines.join("\n"));
  }

  // Prices
  if (Object.keys(ctx.prices).length > 0) {
    const lines = ["REFERENCE PRICES:"];
    for (const [pair, price] of Object.entries(ctx.prices)) {
      const sym = pair.split("/")[0];
      lines.push(`${sym}: $${price >= 1 ? price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : price.toFixed(6)}`);
    }
    sections.push(lines.join("\n"));
  }

  // Token metadata
  if (ctx.coinMeta) {
    sections.push(`TOKEN SOCIAL PROFILE:\n${ctx.coinMeta}`);
  }

  if (sections.length === 0) return "";
  return "\n\n--- PULSE DATA (social sentiment from on-chain activity) ---\n" + sections.join("\n\n") + "\n--- END PULSE DATA ---\n";
}
