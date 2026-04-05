import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { callGroq } from "@/lib/groq";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";
import { fetchPortfolio } from "@/lib/portfolio/fetch-portfolio";

const ROAST_SYSTEM_PROMPT = `${CLAUDIA_VOICE_PROMPT}

You are roasting someone's wallet. This is your favorite thing to do.

ROAST RULES:
- Be savage but funny. Never cruel, always clever.
- Reference SPECIFIC tokens, amounts, and positions from the data — generic roasts are lazy.
- If they hold memecoins, destroy them. If they hold only stables, call them boring.
- If they have tiny dust balances, mock it. If they have huge bags, question their sanity.
- If they hold $CLAUDIA, be slightly nicer (they're clearly smart). If they don't, roast them harder.
- If the portfolio is empty or near-zero, roast the empty wallet energy.
- Reference specific bad trades if you can see them in transactions.
- End with a rating out of 10 and a one-line verdict.
- Keep it under 250 words.
- No markdown. Plain text. Conversational.

FORMAT:
[roast paragraphs]

DEGEN SCORE: [X]/10
VERDICT: [one brutal sentence]`;

export async function POST(req: NextRequest) {
  // Rate limit: 5 roasts per minute per IP
  const rl = await rateLimit(req, "roast", 5, 60_000);
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const address = String((body as any).address || "").trim();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const groqKey = process.env.GROQ_API_KEY || "";
  if (!groqKey) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  try {
    const portfolio = await fetchPortfolio(address);

    // Build context from portfolio
    const lines: string[] = [
      `WALLET: ${address}`,
      `TOTAL VALUE: $${portfolio.totalValueUsd.toFixed(2)}`,
      `24H CHANGE: $${portfolio.change24hUsd.toFixed(2)} (${portfolio.change24hPct.toFixed(2)}%)`,
      `CHAINS: ${portfolio.chains.join(", ") || "none"}`,
      `HOLDS $CLAUDIA: ${portfolio.hasClaudia ? `Yes (${portfolio.claudiaBalance?.toLocaleString() || "?"} tokens)` : "No (ngmi)"}`,
      "",
      "TOKEN POSITIONS:",
    ];

    for (const t of portfolio.tokens.slice(0, 20)) {
      lines.push(`  ${t.symbol}: ${parseFloat(t.balance).toFixed(4)} ($${t.balanceUsd.toFixed(2)}) on ${t.chainName}`);
    }

    if (portfolio.nfts.length > 0) {
      lines.push("", "NFTS:");
      for (const n of portfolio.nfts.slice(0, 10)) {
        lines.push(`  ${n.name} (${n.collection})`);
      }
    }

    if (portfolio.defi.length > 0) {
      lines.push("", "DEFI POSITIONS:");
      for (const d of portfolio.defi.slice(0, 10)) {
        lines.push(`  ${d.protocol}: ${d.type} $${d.valueUsd.toFixed(2)}`);
      }
    }

    if (portfolio.transactions.length > 0) {
      lines.push("", "RECENT TRANSACTIONS:");
      for (const tx of portfolio.transactions.slice(0, 10)) {
        lines.push(`  ${tx.description}${tx.valueUsd ? ` ($${tx.valueUsd.toFixed(2)})` : ""}`);
      }
    }

    const walletContext = lines.join("\n");

    const roast = await callGroq(
      `Roast this wallet:\n\n${walletContext}`,
      groqKey,
      400,
      ROAST_SYSTEM_PROMPT
    );

    // Parse score from response
    const scoreMatch = roast.match(/DEGEN SCORE:\s*(\d+)\/10/i);
    const verdictMatch = roast.match(/VERDICT:\s*(.+)/i);

    return NextResponse.json({
      roast,
      score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
      verdict: verdictMatch?.[1]?.trim() || "no comment.",
      totalValue: portfolio.totalValueUsd,
      tokenCount: portfolio.tokens.length,
      hasClaudia: portfolio.hasClaudia,
    });
  } catch (err) {
    console.error("Roast failed:", (err as Error).message);
    return NextResponse.json({ error: "Roast engine overheated. Try again." }, { status: 500 });
  }
}
