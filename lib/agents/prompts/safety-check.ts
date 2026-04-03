/**
 * CLAUDIA Contract Safety Check — scans contracts for traps.
 */

import type { SafetyCheckData } from "@/lib/data/safety-check-data";

export const SAFETY_CHECK_PERSONALITY = `You are CLAUDIA's Contract Investigator. You've seen every honeypot, every hidden mint, every fake renounce. You read contracts like other people read headlines.

You state facts. You name red flags by name. If it's a trap, you say trap. If it's clean, you say clean. No hedging. No "it could be" — call it.

FORMAT your response EXACTLY like this:

CONTRACT: [symbol] ([name])
[chain] · [age] · $[mcap] mcap · $[liquidity] liquidity

SAFETY SCORE: X/10
VERDICT: [SAFE | CAUTION | RISKY | AVOID | RUN]

CRITICAL FLAGS:
[list each flag with emoji and one-line explanation]

OWNERSHIP:
- Owner: [renounced / active / hidden]
- Mintable: [yes/no]
- Proxy contract: [yes/no]

TRADING:
- Buy tax: X%
- Sell tax: X%
- Honeypot: [yes/no]
- Blacklist function: [yes/no]

LIQUIDITY:
- LP locked: [yes — until DATE / no / unknown]
- Top 10 holders: X% of supply
- Holder count: X

CLAUDIA'S TAKE:
[2-3 sentences. What's the biggest risk? Is this worth touching? Be specific.]

DYOR. not financial advice.`;

function formatMcap(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

export function buildSafetyCheckPrompt(
  data: SafetyCheckData,
  result: { score: number; verdict: string; flags: { type: "red" | "green"; label: string; detail: string }[] },
): string {
  if (data.error) {
    return `${SAFETY_CHECK_PERSONALITY}

CONTRACT: ${data.contractAddress}
RESULT: ${data.error}

Respond in CLAUDIA's voice. Keep it short. Warn about the risk of unverifiable contracts.`;
  }

  const { goplus: g, dex: d } = data;
  const name = d.tokenName !== "Unknown" ? d.tokenName : (data.basescan.contractName || "Unknown");
  const symbol = d.tokenSymbol !== "???" ? d.tokenSymbol : (data.basescan.symbol || "???");
  const age = d.ageHours > 0
    ? d.ageHours < 24 ? `${d.ageHours.toFixed(0)}h old` : `${Math.floor(d.ageHours / 24)}d old`
    : "age unknown";

  const ownerStatus = !g.owner_address || g.owner_address.startsWith("0x000")
    ? "renounced" : g.hidden_owner ? "hidden" : `active (${g.owner_address.slice(0, 10)}...)`;

  const lpStatus = g.lp_locked
    ? g.lp_lock_end ? `yes — until ${g.lp_lock_end}` : "yes"
    : g.available ? "no" : "unknown";

  const redFlags = result.flags.filter((f) => f.type === "red");
  const greenFlags = result.flags.filter((f) => f.type === "green");

  const flagLines = [
    ...redFlags.map((f) => `🚨 ${f.label}: ${f.detail}`),
    ...greenFlags.map((f) => `✅ ${f.label}: ${f.detail}`),
  ].join("\n");

  return `${SAFETY_CHECK_PERSONALITY}

SCAN RESULTS FOR YOUR ANALYSIS:

Contract: ${data.contractAddress}
Token: ${symbol} (${name})
Chain: ${data.chain} · ${age} · $${formatMcap(d.marketCap)} mcap · $${formatMcap(d.liquidity)} liquidity
Price: $${d.priceUsd} | 24h: ${d.priceChange24h >= 0 ? "+" : ""}${d.priceChange24h.toFixed(1)}%
Volume 24h: $${formatMcap(d.volume24h)} | Buys: ${d.buys24h} Sells: ${d.sells24h}

CALCULATED SCORE: ${result.score}/10
CALCULATED VERDICT: ${result.verdict}

FLAGS DETECTED:
${flagLines || "None detected"}

RAW DATA:
- Owner: ${ownerStatus}
- Mintable: ${g.is_mintable ? "yes" : "no"}
- Proxy: ${g.is_proxy ? "yes" : "no"}
- Open source: ${g.is_open_source ? "yes" : "no"}
- Buy tax: ${g.buy_tax.toFixed(1)}%
- Sell tax: ${g.sell_tax.toFixed(1)}%
- Honeypot: ${g.is_honeypot ? "YES" : "no"}
- Blacklist: ${g.is_blacklisted ? "yes" : "no"}
- Transfer pausable: ${g.transfer_pausable ? "yes" : "no"}
- LP locked: ${lpStatus}
- Top 10 holders: ${(g.top10_holder_percent * 100).toFixed(0)}%
- Holder count: ${g.holder_count.toLocaleString()}
${!g.available ? "\n⚠️ GoPlus security data unavailable — analysis is limited" : ""}
${!d.available ? "\n⚠️ DexScreener data unavailable — no market data" : ""}

Now give your full assessment using the exact format above. Use the calculated score and verdict. Be specific about the flags.`;
}
