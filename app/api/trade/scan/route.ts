import { NextRequest, NextResponse } from "next/server";
import { fetchTicker, type ExchangeId } from "@/lib/exchange";
import { SUPPORTED_PAIRS } from "@/lib/kraken-pairs";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";
import { getTaapiIndicators } from "@/lib/data/taapi";

const SCAN_PROMPT = `You are NOT an analyst. You are Claudia — the trading advisor who's slightly annoyed she has to explain this but is going to nail it anyway.

You're looking at real crypto data. Give blunt, opinionated signals. You have STRONG opinions. If something looks like trash, say it's trash. If it's a buy, own it.

For EACH coin, use this EXACT format:

### SYMBOL — SIGNAL
**Entry:** $X → **Target:** $Y | **Stop:** $Z
*One savage sentence explaining why.*

PERSONALITY RULES:
- You sound like a sharp trader who's seen it all and is mildly irritated.
- Never say "this is not financial advice" — you don't do disclaimers.
- Never say "I'd recommend" or "you might want to consider" — you TELL them what to do.
- If RSI is over 70, roast the overbought coins. If under 30, get excited.
- Short and brutal. No filler. No fluff.
- End with one overall market vibe sentence — make it memorable.`;

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rlError = await rateLimit(req, "scan", 5, 60_000);
    if (rlError) return rlError;

    // Auth + token gate
    const session = await requireAuthAndBalance(req, GATE_THRESHOLDS.trading, "trading");
    if (session instanceof NextResponse) return session;

    const { watchlist, exchange } = await req.json() as any;
    const exchangeId: ExchangeId = exchange || "kraken";

    if (!watchlist || !Array.isArray(watchlist) || watchlist.length === 0 || watchlist.length > 5) {
      return NextResponse.json({ error: "Watchlist must be 1-5 symbols" }, { status: 400 });
    }

    const symbols = watchlist
      .map((s: string) => String(s).toUpperCase().trim())
      .filter((s: string) => SUPPORTED_PAIRS.includes(s));

    if (symbols.length === 0) {
      return NextResponse.json({ error: "No valid symbols" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      symbols.map(async (symbol: string) => {
        const [indicators, ticker] = await Promise.all([
          getTaapiIndicators(`${symbol}/USD`, "1h").catch(() => null),
          fetchTicker(exchangeId, symbol),
        ]);
        const rsi = indicators?.rsi ?? 50;
        const price = indicators?.candle?.close ?? ticker.price;
        const change24h = indicators?.candle ? ((indicators.candle.close - indicators.candle.open) / indicators.candle.open * 100) : 0;
        return { symbol, ticker, indicators: { rsi, price, change24h }, taapiIndicators: indicators };
      })
    );

    let dataContext = "Current market data:\n\n";
    const validResults: any[] = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { symbol, ticker, indicators, taapiIndicators } = r.value;
        validResults.push(r.value);
        dataContext += `**${symbol}/USD** — $${ticker.price.toLocaleString()}\n`;
        dataContext += `  RSI: ${indicators.rsi} | 24h: ${indicators.change24h > 0 ? "+" : ""}${indicators.change24h.toFixed(2)}%\n`;
        if (taapiIndicators?.ema50 != null && taapiIndicators?.ema200 != null) {
          dataContext += `  EMA50: $${taapiIndicators.ema50.toFixed(2)} | EMA200: $${taapiIndicators.ema200.toFixed(2)}\n`;
        }
        if (taapiIndicators?.bbands) {
          dataContext += `  BB: Upper $${taapiIndicators.bbands.upper.toFixed(2)} | Lower $${taapiIndicators.bbands.lower.toFixed(2)}\n`;
        }
        dataContext += `  24h Volume: $${(ticker.volume24h * ticker.price).toLocaleString()}\n`;
        dataContext += "\n";
      }
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SCAN_PROMPT },
          { role: "user", content: `Scan these and give me trading signals:\n\n${dataContext}` },
        ],
        temperature: 0.9,
        max_tokens: 1500,
      }),
    });

    if (!groqRes.ok) {
      return NextResponse.json({ error: "Analysis failed. Try again." }, { status: 502 });
    }

    const completion = await groqRes.json() as any;
    const analysis = completion.choices?.[0]?.message?.content || "Couldn't analyze. Try again.";

    return NextResponse.json({
      analysis,
      data: validResults.map((r) => ({
        symbol: r.symbol,
        price: r.ticker.price,
        bid: r.ticker.bid,
        ask: r.ticker.ask,
        rsi: r.indicators?.rsi ?? null,
        change24h: r.indicators?.change24h ?? null,
        volume24h: r.ticker.volume24h * r.ticker.price,
      })),
    });
  } catch (err) {
    console.error("Scan error:", (err as Error).message);
    return NextResponse.json({ error: "Scan failed. Try again." }, { status: 500 });
  }
}
