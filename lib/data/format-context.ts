/**
 * Format AgentDataContext into a clean text block for AI prompts.
 * Only includes sections that have data — no empty headers.
 */

import type { AgentDataContext } from "./agent-data";
import { formatTaapiContext } from "./taapi";
import { formatFredContext } from "./fred";
import { formatGasContext } from "./gas";

/** Sanitize external data before injecting into AI prompt. Strips newlines and special chars. */
function sanitizeForPrompt(value: string, maxLength = 20): string {
  return value.replace(/[^\w\s$.\-]/g, "").slice(0, maxLength).trim() || "???";
}

function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

function formatVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatDataContextForPrompt(context: AgentDataContext): string {
  if (!context || Object.keys(context).length === 0) return "";

  const sections: string[] = [];

  // Prices (CoinGecko — kept)
  if (context.prices && Object.keys(context.prices).length > 0) {
    const lines = ["CURRENT PRICES (CoinGecko):"];
    for (const [pair, price] of Object.entries(context.prices)) {
      const sym = pair.split("/")[0];
      lines.push(`${sym}: $${price >= 1 ? price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : price.toFixed(6)}`);
    }
    sections.push(lines.join("\n"));
  }

  // TAAPI technical indicators
  if (context.taapiIndicators) {
    const formatted = formatTaapiContext(context.taapiIndicators);
    if (formatted) sections.push(formatted);
  }

  // BTC Market Context — CRITICAL for all alt analysis
  if (context.btcContext) {
    const btc = context.btcContext;
    const lines = [
      "=== BTC MARKET CONTEXT (factor into ALL alt decisions) ===",
      `BTC Price: $${btc.price.toLocaleString()} | Trend: ${btc.trend.toUpperCase()}`,
      `RSI(14): ${btc.rsi.toFixed(1)} | MACD Hist: ${btc.macdHistogram.toFixed(4)}`,
    ];
    if (btc.ema50 !== null && btc.ema200 !== null) {
      lines.push(`EMA50: $${btc.ema50.toFixed(0)} | EMA200: $${btc.ema200.toFixed(0)}`);
    }
    lines.push(`24h Change: ${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(2)}%`);
    if (btc.flashCrash) {
      lines.push("⚠️ FLASH CRASH DETECTED — BTC down >5%. DO NOT recommend alts.");
    }
    lines.push(`Safe for Alts: ${btc.safeForAlts ? "Yes" : "NO — be very selective or pass"}`);
    lines.push("===================================================");
    sections.push(lines.join("\n"));
  }

  // FRED economic data
  if (context.fredEconomic) {
    const formatted = formatFredContext(context.fredEconomic);
    if (formatted) sections.push(formatted);
  }

  // Trending pairs (DexScreener)
  if (context.trending && context.trending.length > 0) {
    const lines = ["TRENDING ON BASE (DexScreener):"];
    for (const pair of context.trending.slice(0, 8)) {
      const sym = sanitizeForPrompt(pair.baseToken?.symbol || "???", 10);
      const price = pair.priceUsd ? `$${Number(pair.priceUsd).toFixed(6)}` : "N/A";
      const change24h = pair.priceChange?.h24 != null ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24.toFixed(1)}%` : "";
      const vol = pair.volume?.h24 ? formatVolume(pair.volume.h24) : "";
      const liq = pair.liquidity?.usd ? formatVolume(pair.liquidity.usd) : "";
      lines.push(`${sym}: ${price} ${change24h} | Vol: ${vol} | Liq: ${liq}`);
    }
    sections.push(lines.join("\n"));
  }

  // CoinPaprika fundamentals (market cap, supply, team, beta)
  if (context.coinPaprika) {
    sections.push(context.coinPaprika);
  }

  // DexPaprika on-chain DEX data (price, liquidity, FDV)
  if (context.dexPaprika) {
    sections.push(context.dexPaprika);
  }

  // Gas data (Base chain)
  if (context.gas) {
    const gasText = formatGasContext(context.gas);
    if (gasText) sections.push(gasText);
  }

  // DeFiLlama yield pools
  if (context.yields && context.yields.length > 0) {
    const lines = ["TOP BASE YIELD POOLS (DeFiLlama, live):"];
    for (const pool of context.yields.slice(0, 10)) {
      const base = pool.apyBase != null ? `base: ${pool.apyBase.toFixed(1)}%` : "";
      const reward = pool.apyReward != null ? ` reward: ${pool.apyReward.toFixed(1)}%` : "";
      lines.push(`${pool.project} ${pool.symbol}: ${pool.apy.toFixed(1)}% APY (${base}${reward}) | TVL: $${(pool.tvlUsd / 1e6).toFixed(1)}M${pool.stablecoin ? " [stable]" : ""}`);
    }
    sections.push(lines.join("\n"));
  }

  // DexScreener security data
  if (context.dexScreenerSecurity) {
    sections.push(context.dexScreenerSecurity);
  }

  // Pulse sentiment context
  if (context.pulseContext) {
    sections.push(context.pulseContext);
  }

  // Portfolio context (user opted in)
  if (context.portfolioContext) {
    sections.push(context.portfolioContext);
  }

  if (sections.length === 0) return "";

  return "\n\n--- MARKET DATA (use this to inform your response) ---\n" + sections.join("\n\n") + "\n--- END MARKET DATA ---\n";
}
