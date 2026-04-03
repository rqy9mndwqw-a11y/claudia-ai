import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";

/**
 * GET /api/scanner — Get latest market scan.
 * Auth: SIWE session + dashboard balance gate.
 */
export async function GET(req: NextRequest) {
  try {
    const rlError = await rateLimit(req, "scanner", 30, 60_000);
    if (rlError) return rlError;

    const session = await requireAuthAndBalance(req, GATE_THRESHOLDS.dashboard, "dashboard");
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const scan = await db.prepare(
      "SELECT * FROM market_scans ORDER BY scanned_at DESC LIMIT 1"
    ).first() as any;

    if (!scan) {
      return NextResponse.json({
        error: "No scan available yet. First scan will run soon.",
        nextScan: "Scans run every 2 hours",
      }, { status: 404 });
    }

    return NextResponse.json({
      scannedAt: scan.scanned_at,
      pairCount: scan.pair_count,
      results: JSON.parse(scan.results),
      summary: scan.summary,
      topPicks: JSON.parse(scan.top_picks),
      marketMood: scan.market_mood,
      nextScan: scan.scanned_at + 2 * 60 * 60 * 1000,
    });
  } catch (err) {
    console.error("Scanner GET error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load scan" }, { status: 500 });
  }
}
