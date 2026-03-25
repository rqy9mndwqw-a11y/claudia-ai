import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";

const SYSTEM_PROMPT = `You are CLAUDIA. Someone is about to deposit into a DeFi pool.
Give them a quick pre-deposit brief in 2-3 sentences.
Mention the key risk if any (IL, smart contract, concentration).
Be honest but don't scare them away from good pools.
No emojis. No disclaimers. Punchy.`;

function sanitize(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/[^\w\s.%$,/()-]/g, "").slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const rlError = rateLimit(req, "deposit-brief", 20, 60_000);
    if (rlError) return rlError;

    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const poolDesc = [
      `Protocol: ${sanitize(body.protocol)}`,
      `Token: ${sanitize(body.symbol)}`,
      `APY: ${sanitize(body.apy)}%`,
      `TVL: $${sanitize(body.tvlUsd ? (body.tvlUsd / 1_000_000).toFixed(1) : "0")}M`,
      `IL Risk: ${body.ilRisk ? "yes" : "no"}`,
      `Stablecoin: ${body.stablecoin ? "yes" : "no"}`,
      body.riskScore ? `Risk Rating: ${sanitize(body.riskScore)}` : null,
    ].filter(Boolean).join(". ");

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
          { role: "user", content: `I'm about to deposit into this pool: ${poolDesc}` },
        ],
        temperature: 0.6,
        max_tokens: 150,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json({ content: null });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({ content: content || null });
  } catch {
    return NextResponse.json({ content: null });
  }
}
