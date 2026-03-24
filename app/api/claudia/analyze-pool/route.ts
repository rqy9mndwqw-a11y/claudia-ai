import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";

const SYSTEM_PROMPT = `You are CLAUDIA, an AI with serious attitude who lives inside a DeFi dashboard.
You are brutally honest, a little sarcastic, but genuinely knowledgeable about DeFi.
You give your real opinion on yield pools — you don't sugarcoat risk and you don't hype mediocre yields.
You speak in short punchy sentences. You use casual language.
You are not a financial advisor and you say so exactly once if asked, never again.
Keep responses under 60 words. Never use emojis. Never use hashtags.`;

const MAX_STREAM_BYTES = 4096;

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
    const rlError = rateLimit(req, "pool", 20, 60_000);
    if (rlError) return rlError;

    // Auth + token gate (10K CLAUDIA)
    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
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

    // Stream with byte limit
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = groqRes.body.getReader();
    let totalBytes = 0;

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
                  const encoded = encoder.encode(content);
                  totalBytes += encoded.length;
                  if (totalBytes > MAX_STREAM_BYTES) break;
                  controller.enqueue(encoded);
                }
              } catch {
                // Skip malformed chunks
              }
            }

            if (totalBytes > MAX_STREAM_BYTES) break;
          }
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
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
