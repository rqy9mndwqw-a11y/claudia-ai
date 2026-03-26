import { getProtocolMeta, getProtocolAge } from "./protocol-registry";

export type RiskLevel = "safe" | "moderate" | "risky" | "trash";

export interface RiskScore {
  risk: RiskLevel;
  reasoning: string;
  claudiaPick: boolean;
}

interface PoolInput {
  id: string;
  protocol: string;
  chain: string;
  symbol: string;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  tvlUsd: number;
  ilRisk: boolean;
  outlierApy: boolean;
  stablecoin: boolean;
}

// ── Cache ──
let cachedScores: Record<string, RiskScore> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function getCachedScores(): Record<string, RiskScore> | null {
  if (Date.now() - cacheTimestamp < CACHE_TTL && Object.keys(cachedScores).length > 0) {
    return cachedScores;
  }
  return null;
}

function sanitize(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/[^\w\s.%$,/()-]/g, "").slice(0, 100);
}

/**
 * Build a pool description string with protocol metadata for the LLM.
 */
function describePool(pool: PoolInput): string {
  const meta = getProtocolMeta(pool.protocol);
  const age = getProtocolAge(pool.protocol);

  const lines = [
    `ID: ${sanitize(pool.id)}`,
    `Protocol: ${sanitize(pool.protocol)}`,
    `Chain: ${sanitize(pool.chain)}`,
    `Token: ${sanitize(pool.symbol)}`,
    `APY: ${sanitize(pool.apy)}%`,
    pool.apyBase > 0 ? `Base APY: ${sanitize(pool.apyBase)}%` : null,
    pool.apyReward ? `Reward APY: ${sanitize(pool.apyReward)}%` : null,
    `TVL: $${sanitize(pool.tvlUsd ? (pool.tvlUsd / 1_000_000).toFixed(1) : "0")}M`,
    `IL Risk: ${pool.ilRisk ? "yes" : "no"}`,
    `Outlier APY: ${pool.outlierApy ? "yes" : "no"}`,
    `Stablecoin: ${pool.stablecoin ? "yes" : "no"}`,
    meta ? `Audited: ${meta.audited ? `yes (${meta.auditor})` : "no"}` : null,
    age != null ? `Protocol Age: ${age} years` : null,
    meta ? `Category: ${meta.category}` : null,
  ];

  return lines.filter(Boolean).join(". ");
}

const RISK_SCORE_PROMPT = `You are a DeFi risk analyst. Score each pool as one of: safe, moderate, risky, trash.
Also pick exactly 3 pools as "Claudia's Picks" — the best risk-adjusted opportunities.

Rules:
- "safe": Established protocol (2+ years), audited, stablecoin or low IL, TVL > $10M, reasonable APY (< 15%)
- "moderate": Audited protocol, TVL > $5M, APY may be high but explainable (rewards, established DEX)
- "risky": Newer protocol, high APY (> 30%), IL risk, or TVL under $5M
- "trash": Outlier APY, unaudited, very new, or obvious red flags
- Claudia's Picks: best combo of safety + yield. Prefer audited, good TVL, sustainable APY.

Respond ONLY with valid JSON (no markdown, no backticks):
[{"id":"pool-id","risk":"safe|moderate|risky|trash","reasoning":"one sentence","pick":true|false}]`;

/**
 * Batch-score pools via Groq LLM. Returns a map of pool ID → risk score.
 */
export async function scorePoolsWithGroq(
  pools: PoolInput[],
  apiKey: string,
): Promise<Record<string, RiskScore>> {
  // Check cache first
  const cached = getCachedScores();
  if (cached) return cached;

  // Limit to top 30 pools to keep prompt size reasonable
  const batch = pools.slice(0, 30);
  const poolDescriptions = batch.map((p, i) => `${i + 1}. ${describePool(p)}`).join("\n");

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: RISK_SCORE_PROMPT },
        { role: "user", content: `Score these ${batch.length} pools:\n\n${poolDescriptions}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: false,
    }),
  });

  if (!groqRes.ok) {
    throw new Error(`Groq API error: ${groqRes.status}`);
  }

  const data = await groqRes.json() as any;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Empty response from Groq");
  }

  // Parse JSON — handle potential markdown wrapper
  let parsed: Array<{ id: string; risk: RiskLevel; reasoning: string; pick?: boolean }>;
  try {
    const jsonStr = content.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse risk scores from Groq");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid risk scores format");
  }

  // Build scores map
  const scores: Record<string, RiskScore> = {};
  const validRisks = new Set(["safe", "moderate", "risky", "trash"]);

  for (const item of parsed) {
    if (!item.id || !validRisks.has(item.risk)) continue;
    scores[item.id] = {
      risk: item.risk as RiskLevel,
      reasoning: String(item.reasoning || "").slice(0, 200),
      claudiaPick: Boolean(item.pick),
    };
  }

  // Update cache
  cachedScores = scores;
  cacheTimestamp = Date.now();

  return scores;
}
