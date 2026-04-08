import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { rateLimit } from "@/lib/auth";

/**
 * GET /api/public/scanner — latest scanner results, no auth required.
 * Used by ACP worker, Telegram bot, and external integrations.
 * Cached 5 minutes.
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "public-scanner", 30, 60_000);
    if (rl) return rl;

    const db = getDB();
    const scan = (await db
      .prepare("SELECT * FROM market_scans ORDER BY scanned_at DESC LIMIT 1")
      .first()) as any;

    if (!scan) {
      return NextResponse.json({ error: "No scan data" }, { status: 404 });
    }

    const results = JSON.parse(scan.results || "[]");
    const topPicks = JSON.parse(scan.top_picks || "[]");

    return NextResponse.json(
      {
        scannedAt: scan.scanned_at,
        pairCount: scan.pair_count,
        marketMood: scan.market_mood,
        summary: scan.summary,
        topPicks: topPicks.slice(0, 10),
        results: results.slice(0, 50),
      },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (err) {
    console.error("Public scanner error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load scanner" }, { status: 500 });
  }
}
