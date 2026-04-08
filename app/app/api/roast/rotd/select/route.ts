import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Called by Cloudflare Cron Trigger daily at 9AM UTC
// Also callable manually with BOT_INTERNAL_SECRET for testing

export async function POST(req: NextRequest) {
  // Auth: cron or internal secret
  const authHeader = req.headers.get("authorization");
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;
    const today = new Date().toISOString().split("T")[0];

    // Check if already selected today
    const alreadySelected = await db.prepare(
      `SELECT id FROM roast_submissions WHERE rotd_date = ?`
    ).bind(today).first();

    if (alreadySelected) {
      return NextResponse.json({ message: "Already selected today", id: alreadySelected.id });
    }

    const cutoff = Math.floor(Date.now() / 1000) - 86400; // last 24h

    // Try quality >= 8 first
    let winner = await db.prepare(
      `SELECT * FROM roast_submissions
       WHERE submitted_at > ? AND selected_for_rotd = 0 AND quality_score >= 8
       ORDER BY quality_score DESC, abs(COALESCE(pnl_total, 0)) DESC
       LIMIT 1`
    ).bind(cutoff).first();

    // Fallback to >= 6
    if (!winner) {
      winner = await db.prepare(
        `SELECT * FROM roast_submissions
         WHERE submitted_at > ? AND selected_for_rotd = 0 AND quality_score >= 6
         ORDER BY quality_score DESC, abs(COALESCE(pnl_total, 0)) DESC
         LIMIT 1`
      ).bind(cutoff).first();
    }

    // Last resort: best available
    if (!winner) {
      winner = await db.prepare(
        `SELECT * FROM roast_submissions
         WHERE submitted_at > ? AND selected_for_rotd = 0
         ORDER BY quality_score DESC
         LIMIT 1`
      ).bind(cutoff).first();
    }

    if (!winner) {
      return NextResponse.json({ message: "No submissions in last 24h" }, { status: 404 });
    }

    // Mark as selected
    await db.prepare(
      `UPDATE roast_submissions SET selected_for_rotd = 1, rotd_date = ? WHERE id = ?`
    ).bind(today, winner.id).run();

    return NextResponse.json({ selected: winner });
  } catch (err) {
    console.error("ROTD select error:", (err as Error).message);
    return NextResponse.json({ error: "Selection failed" }, { status: 500 });
  }
}
