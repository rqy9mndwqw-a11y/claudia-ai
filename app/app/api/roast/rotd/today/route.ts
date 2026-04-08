import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Public endpoint — returns today's (or yesterday's) Roast of the Day

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

    // Try today first
    let roast = await db.prepare(
      `SELECT wallet_short, roast_text, roast_punchline, portfolio_usd, quality_score, rotd_date
       FROM roast_submissions WHERE rotd_date = ? AND selected_for_rotd = 1`
    ).bind(today).first();

    let label = "Roast of the Day";

    // Fall back to yesterday
    if (!roast) {
      roast = await db.prepare(
        `SELECT wallet_short, roast_text, roast_punchline, portfolio_usd, quality_score, rotd_date
         FROM roast_submissions WHERE rotd_date = ? AND selected_for_rotd = 1`
      ).bind(yesterday).first();
      label = "Yesterday's Roast";
    }

    if (!roast) {
      return NextResponse.json({ roast: null });
    }

    // Extract first 2 sentences for preview
    const fullText = (roast.roast_text as string).split(/DEGEN SCORE/i)[0].trim();
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    const preview = sentences.slice(0, 2).join(" ").trim();

    return NextResponse.json({
      roast: {
        walletShort: roast.wallet_short,
        preview,
        punchline: roast.roast_punchline,
        portfolioUsd: roast.portfolio_usd,
        qualityScore: roast.quality_score,
        date: roast.rotd_date,
        label,
      },
    }, {
      headers: { "Cache-Control": "public, max-age=3600" }, // 1hr cache
    });
  } catch (err) {
    console.error("ROTD today error:", (err as Error).message);
    return NextResponse.json({ roast: null });
  }
}
