import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { callGroq } from "@/lib/groq";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";
import { fetchPortfolio } from "@/lib/portfolio/fetch-portfolio";
import { getAccessLevel } from "@/lib/auth/access";
import { verifySessionToken } from "@/lib/session-token";

const ROAST_PROMPTS: Record<number, string> = {
  1: `${CLAUDIA_VOICE_PROMPT}

You are giving a FRIENDLY roast of someone's wallet. Light teasing only.

RULES:
- Gentle humor. Their feelings should survive.
- Reference specific tokens and amounts but keep it playful.
- If they hold $CLAUDIA, compliment them. If not, mildly suggest they should.
- End with a rating and verdict.
- Under 200 words. No markdown. Conversational.

FORMAT:
[roast paragraphs]

DEGEN SCORE: [X]/10
VERDICT: [one lighthearted sentence]`,

  2: `${CLAUDIA_VOICE_PROMPT}

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
VERDICT: [one brutal sentence]`,

  3: `${CLAUDIA_VOICE_PROMPT}

MAXIMUM TOXICITY MODE. You are weaponizing this wallet's on-chain history against them.

DESTRUCTION RULES:
- ZERO mercy. Every token, every transaction, every position is ammunition.
- Calculate their worst trade and highlight it. If they bought a top, say so with the exact price.
- If they hold memecoins that dumped, calculate the percentage loss OUT LOUD.
- If they have dust balances, list them individually and mock each one.
- If they hold $CLAUDIA, roast them anyway — even the smart ones make mistakes.
- Reference timestamps. "You bought at 3AM on a Tuesday. That's called desperation."
- Find the most embarrassing thing in the wallet and lead with it.
- Finish with the most devastating one-liner you can generate.
- Under 300 words. No markdown. Scorched earth.

FORMAT:
[devastation paragraphs]

DEGEN SCORE: [X]/10
VERDICT: [the line that makes them screenshot this]`,
};

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

  // Toxicity level: 1 (friendly), 2 (no mercy, default), 3 (maximum — gated to 25K $CLAUDIA or NFT holders)
  let toxicityLevel = Math.min(3, Math.max(1, parseInt((body as any).toxicityLevel) || 2));
  if (toxicityLevel === 3) {
    // Level 3 requires 25,000 $CLAUDIA or NFT — check the AUTHENTICATED requester's wallet,
    // not the roast target. This prevents passing a whale address to bypass the gate.
    let requesterAddress: string | null = null;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const session = await verifySessionToken(token);
      if (session) requesterAddress = session.address;
    }

    if (!requesterAddress) {
      // No valid session — can't verify L3 access, silently downgrade
      toxicityLevel = 2;
    } else {
      try {
        const access = await getAccessLevel(requesterAddress);
        if (!access.canRoastLevel3) {
          toxicityLevel = 2;
        }
      } catch {
        toxicityLevel = 2;
      }
    }
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

    const systemPrompt = ROAST_PROMPTS[toxicityLevel] || ROAST_PROMPTS[2];
    const maxTokens = toxicityLevel === 3 ? 500 : toxicityLevel === 1 ? 300 : 400;

    const roast = await callGroq(
      `Roast this wallet:\n\n${walletContext}`,
      groqKey,
      maxTokens,
      systemPrompt
    );

    // Parse score from response
    const scoreMatch = roast.match(/DEGEN SCORE:\s*(\d+)\/10/i);
    const verdictMatch = roast.match(/VERDICT:\s*(.+)/i);
    const degenScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;
    const verdict = verdictMatch?.[1]?.trim() || "no comment.";

    // Quality scoring — CLAUDIA rates her own roast (server-side, user never sees)
    let qualityScore = 5;
    try {
      const scoreResult = await callGroq(
        roast,
        groqKey,
        10,
        "Rate this roast 1-10 for quality. 10 = devastatingly specific, genuinely funny, highly shareable. 1 = generic, could apply to any wallet. Return ONLY a single integer."
      );
      const parsed = parseInt(scoreResult.trim());
      if (parsed >= 1 && parsed <= 10) qualityScore = parsed;
    } catch {
      // Non-fatal — default to 5
    }

    // Generate a roast ID for submission tracking
    const roastId = crypto.randomUUID();
    const walletShort = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return NextResponse.json({
      roastId,
      roast,
      score: degenScore,
      verdict,
      qualityScore,
      totalValue: portfolio.totalValueUsd,
      tokenCount: portfolio.tokens.length,
      hasClaudia: portfolio.hasClaudia,
      walletShort,
      pnlTotal: portfolio.change24hUsd,
      txCount: portfolio.transactions.length,
    });
  } catch (err) {
    console.error("Roast failed:", (err as Error).message);
    return NextResponse.json({ error: "Roast engine overheated. Try again." }, { status: 500 });
  }
}
