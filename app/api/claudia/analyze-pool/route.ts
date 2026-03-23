import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are CLAUDIA, an AI with serious attitude who lives inside a DeFi dashboard.
You are brutally honest, a little sarcastic, but genuinely knowledgeable about DeFi.
You give your real opinion on yield pools — you don't sugarcoat risk and you don't hype mediocre yields.
You speak in short punchy sentences. You use casual language.
You are not a financial advisor and you say so exactly once if asked, never again.
Keep responses under 60 words. Never use emojis. Never use hashtags.`;

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const rl = checkRateLimit(ip, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Chill. Too many requests." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pool } = body;

    if (!pool || !pool.protocol) {
      return NextResponse.json({ error: "Pool data required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const poolDescription = [
      `Protocol: ${pool.protocol}`,
      `Chain: ${pool.chain}`,
      `Token: ${pool.symbol}`,
      `APY: ${pool.apy}%`,
      pool.apyBase > 0 ? `Base APY: ${pool.apyBase}%` : null,
      pool.apyReward ? `Reward APY: ${pool.apyReward}%` : null,
      `TVL: $${(pool.tvlUsd / 1_000_000).toFixed(1)}M`,
      `IL Risk: ${pool.ilRisk ? "yes" : "no"}`,
      `Outlier APY: ${pool.outlierApy ? "yes" : "no"}`,
      `Stablecoin: ${pool.stablecoin ? "yes" : "no"}`,
      pool.rewardTokens?.length > 0 ? `Reward tokens: ${pool.rewardTokens.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(". ");

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
        temperature: 0.9,
        max_tokens: 150,
        stream: true,
      }),
    });

    if (!groqRes.ok || !groqRes.body) {
      return NextResponse.json(
        { error: "I had thoughts on this one but they didn't survive the trip. Try clicking again." },
        { status: 502 }
      );
    }

    // Stream the response back as SSE
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = groqRes.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Pool analysis error:", (err as Error).message);
    return NextResponse.json(
      { error: "I had thoughts on this one but they didn't survive the trip. Try clicking again." },
      { status: 500 }
    );
  }
}
