import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { postScanToX } from "@/lib/social/post-to-x";
import { saveAlerts } from "@/lib/scanner/performance-check";

/**
 * POST /api/scanner/test-x
 * Protected by SCANNER_SECRET — tests X posting with latest scan data.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scanner-secret");
  if (!secret || secret !== process.env.SCANNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDB();
  const latest = (await db
    .prepare("SELECT * FROM market_scans ORDER BY scanned_at DESC LIMIT 1")
    .first()) as any;

  if (!latest) {
    return NextResponse.json({ error: "No scan data" }, { status: 404 });
  }

  const topPicks = JSON.parse(latest.top_picks || "[]");
  const result = await postScanToX(
    latest.summary,
    topPicks,
    latest.market_mood,
    latest.pair_count,
    {
      apiKey: process.env.X_API_KEY || "",
      apiSecret: process.env.X_API_SECRET || "",
      accessToken: process.env.X_ACCESS_TOKEN || "",
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
    }
  );

  // Save alerts for performance tracking (score >= 7 picks)
  if (result.success && result.tweetId) {
    try {
      await saveAlerts(db, latest.id, result.tweetId, topPicks);
    } catch (e) {
      console.error("Save alerts failed:", (e as Error).message);
    }
  }

  return NextResponse.json(result);
}
