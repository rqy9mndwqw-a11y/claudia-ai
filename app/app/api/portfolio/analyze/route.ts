import { NextRequest, NextResponse } from "next/server";
import { requireAuth, rateLimit } from "@/lib/auth";
import { getDB, deductPlatformCredits, addCreditsAtomic } from "@/lib/marketplace/db";
import type { PortfolioData } from "@/lib/portfolio/fetch-portfolio";
import { formatChainName } from "@/lib/portfolio/fetch-portfolio";

const ANALYSIS_COST = 2;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const rl = await rateLimit(req, "portfolio-analyze", 3, 60_000);
    if (rl) return rl;

    const db = getDB();
    const body = (await req.json().catch(() => null)) as any;
    if (!body?.portfolio) {
      return NextResponse.json({ error: "Portfolio data required" }, { status: 400 });
    }

    const portfolio: PortfolioData = body.portfolio;

    // Deduct credits before analysis
    try {
      await deductPlatformCredits(db, session.address, ANALYSIS_COST, `portfolio-analysis:${Date.now()}`);
    } catch {
      return NextResponse.json(
        { error: "Insufficient credits. Portfolio analysis costs 2 credits." },
        { status: 402 }
      );
    }

    try {
      const topTokens = portfolio.tokens
        .slice(0, 5)
        .map((t) => `${t.symbol}: $${t.balanceUsd.toFixed(0)} (${((t.balanceUsd / (portfolio.totalValueUsd || 1)) * 100).toFixed(1)}%)`)
        .join(", ");

      const prompt = `You are CLAUDIA analyzing a crypto portfolio.

Portfolio value: $${portfolio.totalValueUsd.toFixed(2)}
24h change: ${portfolio.change24hPct >= 0 ? "+" : ""}${portfolio.change24hPct.toFixed(2)}%
Chains: ${portfolio.chains.map(formatChainName).join(", ")}
Top holdings: ${topTokens}
NFTs: ${portfolio.nfts.length} items
Has CLAUDIA: ${portfolio.hasClaudia ? `yes (${portfolio.claudiaBalance?.toLocaleString()} tokens)` : "no"}

Give your honest CLAUDIA-voiced analysis of this portfolio.
Comment on: concentration risk, chain diversification, overall health.
${portfolio.hasClaudia ? "They hold CLAUDIA — acknowledge it without being sycophantic." : "They do not hold CLAUDIA — you may note this with your signature smugness."}
Be direct. Under 120 words. No markdown. No lists.`;

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        // Refund — can't run without API key
        await addCreditsAtomic(db, session.address, ANALYSIS_COST, "refund", `no-groq:${Date.now()}`);
        return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
      }
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 200,
          temperature: 0.7,
          messages: [
            { role: "system", content: "You are CLAUDIA, a sharp-tongued AI DeFi analyst. Be direct, witty, and honest. No markdown." },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
      const groqData = (await groqRes.json()) as any;
      const analysis = groqData.choices?.[0]?.message?.content?.trim() || "";

      if (!analysis) throw new Error("Empty analysis");

      return NextResponse.json({ analysis, creditsCharged: ANALYSIS_COST });
    } catch (err) {
      // Refund on failure
      await addCreditsAtomic(db, session.address, ANALYSIS_COST, "refund", `portfolio-analysis-fail:${Date.now()}`).catch(() => {});
      console.error("Portfolio analysis failed:", (err as Error).message);
      return NextResponse.json({ error: "Analysis failed. Credits refunded." }, { status: 500 });
    }
  } catch (err) {
    console.error("Portfolio analyze error:", (err as Error).message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
