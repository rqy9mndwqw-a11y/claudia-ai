import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";

const SYSTEM_PROMPT = CLAUDIA_VOICE_PROMPT + "\n\nYou are analyzing a DeFi yield pool. Keep this response under 80 words.";

/** Sanitize pool data to prevent prompt injection. */
function sanitizePoolField(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/[^\w\s.%$,/-]/g, "")
    .slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rlError = await rateLimit(req, "pool", 20, 60_000);
    if (rlError) return rlError;

    // Auth + token gate (10K CLAUDIA)
    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json() as any;
    const { pool } = body;

    if (!pool || !pool.protocol) {
      return NextResponse.json({ error: "Pool data required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    // Build pool description from sanitized fields
    const poolDescription = [
      `Protocol: ${sanitizePoolField(pool.protocol)}`,
      `Chain: ${sanitizePoolField(pool.chain)}`,
      `Token: ${sanitizePoolField(pool.symbol)}`,
      `APY: ${sanitizePoolField(pool.apy)}%`,
      pool.apyBase > 0 ? `Base APY: ${sanitizePoolField(pool.apyBase)}%` : null,
      pool.apyReward ? `Reward APY: ${sanitizePoolField(pool.apyReward)}%` : null,
      `TVL: $${sanitizePoolField(pool.tvlUsd ? (pool.tvlUsd / 1_000_000).toFixed(1) : "0")}M`,
      `IL Risk: ${pool.ilRisk ? "yes" : "no"}`,
      `Outlier APY: ${pool.outlierApy ? "yes" : "no"}`,
      `Stablecoin: ${pool.stablecoin ? "yes" : "no"}`,
    ]
      .filter(Boolean)
      .join(". ");

    // Non-streaming request — response is only ~80 words,
    // streaming was causing garbled output from split SSE chunks
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Give me your honest take on this pool: ${poolDescription}` },
        ],
        temperature: 0.7,
        max_tokens: 200,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json(
        { error: "I had thoughts on this one but they didn't survive the trip. Try clicking again." },
        { status: 502 }
      );
    }

    const data = await groqRes.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Claudia had nothing to say. That's a first. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Pool analysis error:", (err as Error).message);
    return NextResponse.json(
      { error: "I had thoughts on this one but they didn't survive the trip. Try clicking again." },
      { status: 500 }
    );
  }
}
