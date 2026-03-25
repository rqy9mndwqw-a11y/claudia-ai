import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";

const COMPARE_PROMPT = `You are CLAUDIA, a brutally honest DeFi expert with attitude.
You're comparing yield opportunities for someone with a specific amount to deploy.

Rules:
- Pick the top 3-5 best options from the pools provided
- For each pick, explain WHY in 1-2 punchy sentences
- Include projected monthly and annual earnings (simple math: amount * APY / 12 for monthly)
- Give an overall recommendation at the end (1-2 sentences)
- Be opinionated. If something is trash, say so.
- No emojis. No disclaimers. Short and sharp.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "picks": [
    {
      "poolId": "the-pool-id",
      "protocol": "protocol name",
      "symbol": "token pair",
      "apy": 12.5,
      "monthlyEarnings": 10.42,
      "annualEarnings": 125.0,
      "take": "Claudia's 1-2 sentence opinion"
    }
  ],
  "summary": "Overall recommendation in 1-2 sentences"
}`;

function sanitize(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/[^\w\s.%$,/()-]/g, "").slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const rlError = rateLimit(req, "compare", 10, 60_000);
    if (rlError) return rlError;

    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { amount, assetType, pools } = body;

    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 10_000_000) {
      return NextResponse.json({ error: "Valid amount required (1 - 10M)" }, { status: 400 });
    }

    if (!assetType || typeof assetType !== "string") {
      return NextResponse.json({ error: "Asset type required" }, { status: 400 });
    }

    if (!Array.isArray(pools) || pools.length === 0) {
      return NextResponse.json({ error: "Pools required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    // Build pool descriptions (top 15 relevant pools)
    const poolDescriptions = pools.slice(0, 15).map((p: any, i: number) => {
      return `${i + 1}. ID: ${sanitize(p.id)} | ${sanitize(p.protocol)} | ${sanitize(p.symbol)} | Chain: ${sanitize(p.chain)} | APY: ${sanitize(p.apy)}% | Base: ${sanitize(p.apyBase)}% | Reward: ${sanitize(p.apyReward || 0)}% | TVL: $${sanitize(p.tvlUsd ? (p.tvlUsd / 1_000_000).toFixed(1) : "0")}M | Stable: ${p.stablecoin ? "yes" : "no"} | IL: ${p.ilRisk ? "yes" : "no"} | Risk: ${sanitize(p.riskScore || "unknown")}`;
    }).join("\n");

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: COMPARE_PROMPT },
          {
            role: "user",
            content: `I have $${amount.toLocaleString()} in ${assetType}. Compare these pools and pick the best options:\n\n${poolDescriptions}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json(
        { error: "Claudia's brain short-circuited. Try again." },
        { status: 502 }
      );
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Claudia went silent. Unusual." },
        { status: 502 }
      );
    }

    // Parse JSON response
    try {
      const jsonStr = content.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      const result = JSON.parse(jsonStr);
      return NextResponse.json(result);
    } catch {
      // If parsing fails, return raw content as summary
      return NextResponse.json({
        picks: [],
        summary: content.slice(0, 500),
      });
    }
  } catch (err) {
    console.error("Compare error:", (err as Error).message);
    return NextResponse.json(
      { error: "Claudia's brain short-circuited. Try again." },
      { status: 500 }
    );
  }
}
