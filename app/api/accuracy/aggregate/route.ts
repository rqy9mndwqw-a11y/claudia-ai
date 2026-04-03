import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { aggregateVerdictAccuracy } from "@/lib/scanner/verdict-outcome-check";

/**
 * POST /api/accuracy/aggregate
 * Protected by SCANNER_SECRET — daily rollup of graded verdicts.
 * Called by scanner-cron worker every 2 hours (idempotent — skips if already aggregated).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scanner-secret");
  if (!secret || secret !== process.env.SCANNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const result = await aggregateVerdictAccuracy(db);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Verdict aggregation failed:", (err as Error).message);
    return NextResponse.json({ error: "Verdict aggregation failed" }, { status: 500 });
  }
}
