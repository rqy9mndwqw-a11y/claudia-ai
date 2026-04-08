import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";

const SYSTEM_PROMPT = CLAUDIA_VOICE_PROMPT + "\n\nYou're reviewing someone's DeFi positions on Base. Flag concentration risk, unsustainable APY, and suggest rebalancing. Under 100 words.";

function sanitize(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/[^\w\s.%$,/()-]/g, "").slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const rlError = await rateLimit(req, "portfolio-check", 10, 60_000);
    if (rlError) return rlError;

    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json() as any;
    const { positions, totalValue } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: "Positions array required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const positionDescriptions = positions.map((p: any, i: number) => {
      return `${i + 1}. ${sanitize(p.protocol)} — ${sanitize(p.pool)} | Tokens: ${sanitize(p.tokens?.join(", "))} | Value: $${sanitize(p.currentValue?.toFixed(2))} | APY: ${p.apy != null ? sanitize(p.apy) + "%" : "unknown"} | Chain: ${sanitize(p.chain)}`;
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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Review my DeFi portfolio. Total value: $${sanitize(totalValue?.toFixed(2))}. ${positions.length} positions:\n\n${positionDescriptions}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 250,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json(
        { error: "Claudia's too busy to check your portfolio right now." },
        { status: 502 }
      );
    }

    const data = await groqRes.json() as any;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Claudia looked at your portfolio and had nothing to say." },
        { status: 502 }
      );
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Portfolio check error:", (err as Error).message);
    return NextResponse.json(
      { error: "Portfolio review failed. Try again." },
      { status: 500 }
    );
  }
}
