import { NextRequest, NextResponse } from "next/server";
import { fetchOHLCV, fetchTicker, SUPPORTED_PAIRS } from "@/lib/kraken";
import { verifyTokenBalance } from "@/lib/verify-token";
import { checkRateLimit } from "@/lib/rate-limit";

const SCAN_PROMPT = `You are NOT an analyst. You are Claudia — the trading advisor who's slightly annoyed she has to explain this but is going to nail it anyway.

You're looking at real crypto data. Give blunt, opinionated signals. You have STRONG opinions. If something looks like trash, say it's trash. If it's a buy, own it.

For EACH coin, use this EXACT format:

### SYMBOL — SIGNAL 🟢/🔴/🟡
**Entry:** $X → **Target:** $Y | **Stop:** $Z
*One savage sentence explaining why.*

Where 🟢 = BUY, 🔴 = SELL, 🟡 = HOLD (don't waste my time).

PERSONALITY RULES:
- You sound like a sharp trader who's seen it all and is mildly irritated.
- Never say "this is not financial advice" — you don't do disclaimers.
- Never say "I'd recommend" or "you might want to consider" — you TELL them what to do.
- If RSI is over 70, roast the overbought coins. If under 30, get excited.
- Short and brutal. No filler. No fluff.
- End with one overall market vibe sentence — make it memorable.

EXAMPLES of your tone:
"AVAX at RSI 76? That's overcooked. Take profits before everyone else does."
"NEAR's setting up nicely. SMA crossover, volume's picking up. Get in before the crowd notices."
"DOT is doing literally nothing. HOLD and stop checking it every five minutes."
"Three overbought, two setting up. If you're not taking profits on the hot ones, you deserve what's coming."`;

function computeIndicators(close: number[]) {
  const len = close.length;
  if (len < 26) return null;

  // RSI (14-period)
  const rsiPeriod = 14;
  let gains = 0, losses = 0;
  for (let i = len - rsiPeriod; i < len; i++) {
    const diff = close[i] - close[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / rsiPeriod;
  const avgLoss = losses / rsiPeriod;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Simple moving averages
  const sma20 = close.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = close.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, close.length);

  // Price change
  const change24h = ((close[len - 1] - close[len - 25]) / close[len - 25]) * 100;
  const change1h = ((close[len - 1] - close[len - 2]) / close[len - 2]) * 100;

  // Volatility (std dev of last 20 returns)
  const returns = close.slice(-21).map((c, i, arr) => i > 0 ? (c - arr[i-1]) / arr[i-1] : 0).slice(1);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  return {
    rsi: Math.round(rsi * 10) / 10,
    sma20: Math.round(sma20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    change24h: Math.round(change24h * 100) / 100,
    change1h: Math.round(change1h * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    price: close[len - 1],
    aboveSma20: close[len - 1] > sma20,
    aboveSma50: close[len - 1] > sma50,
  };
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const rl = checkRateLimit(`scan:${ip}`, 5, 60_000); // 5 scans per minute
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many scans. Wait a minute." }, { status: 429 });
    }

    const { watchlist, address } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Token gate
    try {
      const { authorized } = await verifyTokenBalance(address, 100_000);
      if (!authorized) {
        return NextResponse.json({ error: "Insufficient $CLAUDIA balance." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Unable to verify token balance." }, { status: 503 });
    }

    if (!watchlist || !Array.isArray(watchlist) || watchlist.length === 0 || watchlist.length > 5) {
      return NextResponse.json({ error: "Watchlist must be 1-5 symbols" }, { status: 400 });
    }

    // Validate symbols
    const symbols = watchlist
      .map((s: string) => s.toUpperCase().trim())
      .filter((s: string) => SUPPORTED_PAIRS.includes(s));

    if (symbols.length === 0) {
      return NextResponse.json({ error: "No valid symbols" }, { status: 400 });
    }

    // Fetch data for all symbols in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol: string) => {
        const [ohlcv, ticker] = await Promise.all([
          fetchOHLCV(symbol, 60),
          fetchTicker(symbol),
        ]);
        const indicators = computeIndicators(ohlcv.close);
        return { symbol, ticker, indicators };
      })
    );

    // Build context for AI
    let dataContext = "Current market data:\n\n";
    const validResults: any[] = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        const { symbol, ticker, indicators } = r.value;
        validResults.push(r.value);
        dataContext += `**${symbol}/USD** — $${ticker.price.toLocaleString()}\n`;
        if (indicators) {
          dataContext += `  RSI: ${indicators.rsi} | 24h: ${indicators.change24h > 0 ? "+" : ""}${indicators.change24h}% | 1h: ${indicators.change1h > 0 ? "+" : ""}${indicators.change1h}%\n`;
          dataContext += `  SMA20: $${indicators.sma20.toLocaleString()} (${indicators.aboveSma20 ? "above" : "below"}) | SMA50: $${indicators.sma50.toLocaleString()} (${indicators.aboveSma50 ? "above" : "below"})\n`;
          dataContext += `  Volatility: ${indicators.volatility}% | 24h Volume: $${(ticker.volume24h * ticker.price).toLocaleString()}\n`;
        }
        dataContext += "\n";
      }
    }

    // Call Groq for AI analysis
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

    const completion = await groqRes.json();
    const analysis = completion.choices?.[0]?.message?.content || "Couldn't analyze. Try again.";

    return NextResponse.json({
      analysis,
      data: validResults.map((r) => ({
        symbol: r.symbol,
        price: r.ticker.price,
        bid: r.ticker.bid,
        ask: r.ticker.ask,
        rsi: r.indicators?.rsi,
        change24h: r.indicators?.change24h,
        volume24h: r.ticker.volume24h * r.ticker.price,
      })),
    });
  } catch (err) {
    console.error("Scan error:", (err as Error).message);
    return NextResponse.json({ error: "Scan failed. Try again." }, { status: 500 });
  }
}
