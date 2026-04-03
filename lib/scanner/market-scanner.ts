/**
 * CLAUDIA Market Scanner.
 *
 * Pipeline:
 * 1. TAAPI → prices + RSI + candle data (no CoinGecko dependency)
 * 2. DeepSeek R1 → individual AI scoring for core pairs
 * 3. Groq → batch AI scoring for remaining pairs
 * 4. Rule-based fallback if both AI paths fail
 * 5. Groq → CLAUDIA voice summary
 *
 * All price data comes from TAAPI candle endpoint (Binance exchange data).
 */

import { getTaapiIndicators } from "@/lib/data/taapi";
import { runCFAI } from "@/lib/cloudflare-ai";
import { callGroq } from "@/lib/groq";

// ── 75 pairs — all major Binance listings ──

// Core pairs — DeepSeek R1 individual scoring (top 10)
const CORE_PAIRS = [
  "BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD",
  "LINK/USD", "AVAX/USD", "DOGE/USD", "ADA/USD", "ARB/USD",
];

// Extended pairs — Groq batch scoring
const EXTENDED_PAIRS = [
  // L1s
  "DOT/USD", "ATOM/USD", "NEAR/USD", "SUI/USD", "APT/USD",
  "HBAR/USD", "ICP/USD", "FIL/USD", "ALGO/USD", "XLM/USD",
  "LTC/USD", "BCH/USD", "ETC/USD", "XMR/USD", "ZEC/USD",
  "KAS/USD", "TAO/USD", "SEI/USD", "TIA/USD", "TON/USD",
  // L2 / Scaling
  "OP/USD", "POL/USD", "IMX/USD", "STRK/USD", "MANTA/USD",
  // DeFi
  "UNI/USD", "AAVE/USD", "MKR/USD", "CRV/USD", "SNX/USD",
  "COMP/USD", "LDO/USD", "PENDLE/USD", "ENA/USD", "JUP/USD",
  // AI / Data
  "FET/USD", "RENDER/USD", "GRT/USD", "ONDO/USD",
  "WLD/USD", "AKT/USD", "AR/USD",
  // Infrastructure
  "INJ/USD", "RUNE/USD", "STX/USD", "TRX/USD", "VET/USD",
  // Gaming / Metaverse
  "GALA/USD", "AXS/USD", "SAND/USD",
  // Meme
  "PEPE/USD", "SHIB/USD", "WIF/USD", "BONK/USD", "FLOKI/USD",
  "DEGEN/USD",
];

const ALL_PAIRS = [...new Set([...CORE_PAIRS, ...EXTENDED_PAIRS])];

export interface ScanResult {
  ticker: string;
  symbol: string;
  price: number;
  change24h: number;
  score: number;
  rating: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  topSignal: string;
  rsi: number;
  reasoning: string;
}

// ── Pair data gathering — TAAPI only, no CoinGecko ──

interface PairData {
  pair: string;
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  rsi: number;
  volRatio: number;
}

async function gatherPairData(pairs: string[]): Promise<PairData[]> {
  const results: PairData[] = [];
  const batchSize = 3;

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (pair): Promise<PairData | null> => {
        const symbol = pair.split("/")[0];

        try {
          const ind = await getTaapiIndicators(pair, "1d");

          // Price from TAAPI candle — no CoinGecko needed
          if (!ind.candle || !ind.candle.close) return null;

          const price = ind.candle.close;
          const rsi = ind.rsi ?? 50;
          const change24h = ind.candle.open > 0
            ? ((price - ind.candle.open) / ind.candle.open) * 100
            : 0;

          return {
            pair,
            symbol,
            price,
            change24h,
            change7d: 0, // Would need a separate weekly candle call
            rsi,
            volRatio: 1,
          };
        } catch (err) {
          console.error(`TAAPI failed for ${pair}:`, (err as Error).message);
          return null;
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }

    if (i + batchSize < pairs.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return results;
}

// ── Rule-based scoring ──

function ruleBasedScore(d: PairData): { score: number; rating: ScanResult["rating"]; signal: string; reasoning: string } {
  let score = 5;
  const signals: string[] = [];

  if (d.rsi < 25) { score += 3; signals.push(`RSI ${d.rsi} deeply oversold`); }
  else if (d.rsi < 35) { score += 2; signals.push(`RSI ${d.rsi} oversold zone`); }
  else if (d.rsi < 45) { score += 0.5; }
  else if (d.rsi > 80) { score -= 3; signals.push(`RSI ${d.rsi} extremely overbought`); }
  else if (d.rsi > 70) { score -= 2; signals.push(`RSI ${d.rsi} overbought`); }
  else if (d.rsi > 60) { score -= 0.5; }

  if (d.change24h > 8) { score += 1.5; signals.push(`Strong rally +${d.change24h.toFixed(1)}%`); }
  else if (d.change24h > 3) { score += 1; signals.push(`Positive +${d.change24h.toFixed(1)}%`); }
  else if (d.change24h < -8) { score -= 1; signals.push(`Heavy selling ${d.change24h.toFixed(1)}%`); }
  else if (d.change24h < -3) { score -= 0.5; signals.push(`Negative ${d.change24h.toFixed(1)}%`); }

  if (d.volRatio > 2) { score += 0.5; signals.push(`Volume ${d.volRatio.toFixed(1)}x`); }
  if (d.rsi < 35 && d.change24h > 2) { score += 1; signals.push("Oversold bounce"); }
  if (d.rsi > 70 && d.change24h < -2) { score += 0.5; signals.push("Overbought reversal"); }

  score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));
  const rating: ScanResult["rating"] = score >= 8 ? "STRONG_BUY" : score >= 6.5 ? "BUY" : score >= 4 ? "HOLD" : score >= 2.5 ? "SELL" : "STRONG_SELL";
  const topSignal = signals[0] || `RSI ${d.rsi}`;
  const reasoning = signals.length > 0 ? signals.slice(0, 2).join(". ") + "." : `Neutral at RSI ${d.rsi}.`;

  return { score, rating, signal: topSignal, reasoning };
}

// ── DeepSeek R1 individual scoring (core pairs) ──

async function deepSeekScore(
  ai: any,
  d: PairData
): Promise<{ score: number; rating: string; signal: string; reasoning: string } | null> {
  const prompt = `Score this crypto 1-10. Respond ONLY with JSON, no other text, no markdown.

${d.symbol}: $${d.price.toLocaleString()} | 24h: ${d.change24h >= 0 ? "+" : ""}${d.change24h.toFixed(1)}% | RSI(14): ${d.rsi}

{"score":7,"rating":"BUY","signal":"short description max 10 words","reasoning":"one specific sentence about why"}`;

  try {
    const res = await runCFAI(ai, "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      [{ role: "user", content: prompt }],
      { maxTokens: 120, temperature: 0.1 }
    );

    const jsonMatch = res.text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.score === "number") {
        return {
          score: Math.min(10, Math.max(1, parsed.score)),
          rating: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"].includes(parsed.rating) ? parsed.rating : "HOLD",
          signal: String(parsed.signal || "").slice(0, 80),
          reasoning: String(parsed.reasoning || "").slice(0, 150),
        };
      }
    }
  } catch (err) {
    console.error(`DeepSeek score failed for ${d.symbol}:`, (err as Error).message);
  }

  return null;
}

// ── Groq batch scoring ──

async function groqBatchScore(
  pairs: PairData[],
  groqApiKey: string
): Promise<Record<string, { score: number; rating: string; signal: string; reasoning: string }>> {
  const results: Record<string, { score: number; rating: string; signal: string; reasoning: string }> = {};
  if (pairs.length === 0) return results;

  const pairLines = pairs.map((p) =>
    `${p.symbol}: $${p.price.toLocaleString()} | 24h: ${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}% | RSI: ${Math.round(p.rsi)}`
  ).join("\n");

  const prompt = `Score each crypto 1-10. Respond ONLY with a JSON array.

${pairLines}

[{"symbol":"BTC","score":7,"rating":"BUY","signal":"short signal","reasoning":"one sentence"}]
Rating: 8-10=STRONG_BUY, 6.5-7.9=BUY, 4-6.4=HOLD, 2.5-3.9=SELL, 1-2.4=STRONG_SELL`;

  try {
    const response = await callGroq(prompt, groqApiKey, 1500, "Respond with ONLY valid JSON arrays. No markdown.");
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as any[];
      for (const item of parsed) {
        if (item.symbol && typeof item.score === "number") {
          results[item.symbol] = {
            score: Math.min(10, Math.max(1, item.score)),
            rating: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"].includes(item.rating) ? item.rating : "HOLD",
            signal: String(item.signal || "").slice(0, 80),
            reasoning: String(item.reasoning || "").slice(0, 150),
          };
        }
      }
    }
  } catch (err) {
    console.error("Groq batch scoring failed:", (err as Error).message);
  }

  return results;
}

// ── Main ──

export async function runMarketScan(ai: any, groqApiKey: string): Promise<{
  results: ScanResult[];
  summary: string;
  topPicks: ScanResult[];
  marketMood: string;
}> {
  // Step 1: TAAPI for all data — prices + RSI + candle (no CoinGecko)
  console.log(`Scanning ${ALL_PAIRS.length} pairs via TAAPI...`);
  const allPairData = await gatherPairData(ALL_PAIRS);

  if (allPairData.length === 0) {
    throw new Error("No pair data available from TAAPI");
  }
  console.log(`TAAPI returned data for ${allPairData.length}/${ALL_PAIRS.length} pairs`);

  const corePairData = allPairData.filter((d) => CORE_PAIRS.includes(d.pair));
  const extPairData = allPairData.filter((d) => !CORE_PAIRS.includes(d.pair));

  // Step 2: DeepSeek R1 scoring for core pairs
  const deepSeekScores: Record<string, { score: number; rating: string; signal: string; reasoning: string }> = {};
  const dsBatchSize = 3;

  for (let i = 0; i < corePairData.length; i += dsBatchSize) {
    const batch = corePairData.slice(i, i + dsBatchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (d) => {
        const result = await deepSeekScore(ai, d);
        return { symbol: d.symbol, result };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value.result) {
        deepSeekScores[r.value.symbol] = r.value.result;
      }
    }

    if (i + dsBatchSize < corePairData.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const dsSuccessCount = Object.keys(deepSeekScores).length;
  console.log(`DeepSeek scored ${dsSuccessCount}/${corePairData.length} core pairs`);

  // Step 3: Groq batch scoring for remaining pairs
  const needsGroq = [
    ...corePairData.filter((d) => !deepSeekScores[d.symbol]),
    ...extPairData,
  ];

  let groqScores: Record<string, { score: number; rating: string; signal: string; reasoning: string }> = {};
  if (needsGroq.length > 0 && groqApiKey) {
    for (let i = 0; i < needsGroq.length; i += 12) {
      const batch = needsGroq.slice(i, i + 12);
      const batchScores = await groqBatchScore(batch, groqApiKey);
      Object.assign(groqScores, batchScores);
      if (i + 12 < needsGroq.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  const groqSuccessCount = Object.keys(groqScores).length;
  console.log(`Groq scored ${groqSuccessCount}/${needsGroq.length} remaining pairs`);

  // Step 4: Assemble results
  const allResults: ScanResult[] = [];

  for (const d of allPairData) {
    const dsScore = deepSeekScores[d.symbol];
    const gqScore = groqScores[d.symbol];
    const rule = ruleBasedScore(d);

    const best = dsScore || gqScore || rule;

    allResults.push({
      ticker: d.pair,
      symbol: d.symbol,
      price: d.price,
      change24h: Math.round(d.change24h * 100) / 100,
      score: Math.round(best.score * 10) / 10,
      rating: best.rating as ScanResult["rating"],
      topSignal: best.signal || rule.signal,
      rsi: d.rsi,
      reasoning: best.reasoning || rule.reasoning,
    });
  }

  allResults.sort((a, b) => b.score - a.score);

  const topPicks = allResults
    .filter((r) => r.rating === "STRONG_BUY" || r.rating === "BUY")
    .slice(0, 5);

  const avgScore = allResults.reduce((s, r) => s + r.score, 0) / allResults.length;
  const marketMood = avgScore >= 7 ? "bullish" : avgScore >= 5.5 ? "neutral" : avgScore >= 4 ? "mixed" : "bearish";

  // Step 5: CLAUDIA summary
  let summary = `Scanned ${allResults.length} pairs. ${dsSuccessCount + groqSuccessCount} AI-scored. Mood: ${marketMood}.`;
  try {
    const topStr = topPicks.length > 0
      ? topPicks.map((p) => `${p.symbol} $${p.price.toLocaleString()} ${p.score}/10 (${p.topSignal})`).join(", ")
      : "nothing stood out";

    summary = await callGroq(
      `You are CLAUDIA. Scan complete — ${allResults.length} pairs, ${dsSuccessCount + groqSuccessCount} AI-scored.
Mood: ${marketMood} | Avg: ${avgScore.toFixed(1)}/10
Top: ${topStr}
Weakest: ${allResults.slice(-3).map((p) => `${p.symbol} ${p.score}/10`).join(", ")}
2-3 sentences. Name specific tokens with prices. Be direct. No markdown.`,
      groqApiKey,
      150
    );
  } catch {}

  return { results: allResults, summary, topPicks, marketMood };
}
