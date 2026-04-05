import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "rotd-submit", 3, 86_400_000); // 3 per day per IP
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { roastId, walletAddress, roastText, qualityScore, portfolioUsd, pnlTotal, txCount } = body as any;

  if (!roastId || !walletAddress || !roastText) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Extract punchline — last sentence before DEGEN SCORE
  const punchline = roastText.split(/DEGEN SCORE/i)[0]?.trim().split(/[.!]\s+/).pop()?.trim() || null;
  const walletShort = String(walletAddress).includes("...")
    ? walletAddress
    : `${String(walletAddress).slice(0, 6)}...${String(walletAddress).slice(-4)}`;

  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    // Check if this wallet already submitted today
    const today = new Date().toISOString().split("T")[0];
    const existing = await db.prepare(
      `SELECT id FROM roast_submissions WHERE wallet_short = ? AND date(submitted_at, 'unixepoch') = ?`
    ).bind(walletShort, today).first();

    if (existing) {
      return NextResponse.json({ error: "Already submitted today. Try again tomorrow." }, { status: 429 });
    }

    await db.prepare(
      `INSERT INTO roast_submissions (id, wallet_address, wallet_short, roast_text, roast_punchline, portfolio_usd, pnl_total, tx_count, quality_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      roastId,
      String(walletAddress).toLowerCase(),
      walletShort,
      roastText,
      punchline,
      portfolioUsd ?? null,
      pnlTotal ?? null,
      txCount ?? null,
      qualityScore ?? 5,
    ).run();

    // Submissions go to D1 silently — CLAUDIA curates and posts a shortlist
    // at 8PM UTC daily for community voting. No immediate Telegram post.

    return NextResponse.json({ ok: true, message: "Submitted. CLAUDIA will judge." });
  } catch (err) {
    console.error("ROTD submit error:", (err as Error).message);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
