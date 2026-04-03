import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { checkAlertPerformance } from "@/lib/scanner/performance-check";

/**
 * POST /api/scanner/performance
 * Protected by SCANNER_SECRET — runs performance check on mature alerts.
 * Called by scanner-cron worker every 2 hours.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scanner-secret");
  if (!secret || secret !== process.env.SCANNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const stats = await checkAlertPerformance(db, {
      apiKey: process.env.X_API_KEY || "",
      apiSecret: process.env.X_API_SECRET || "",
      accessToken: process.env.X_ACCESS_TOKEN || "",
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
    });

    return NextResponse.json({ success: true, ...stats });
  } catch (err) {
    console.error("Performance check failed:", (err as Error).message);
    return NextResponse.json({ error: "Performance check failed" }, { status: 500 });
  }
}
