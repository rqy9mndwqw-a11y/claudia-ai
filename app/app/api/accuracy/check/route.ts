import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { checkVerdictOutcomes } from "@/lib/scanner/verdict-outcome-check";

/**
 * POST /api/accuracy/check
 * Protected by SCANNER_SECRET — grades mature verdict predictions.
 * Called by scanner-cron worker every 2 hours.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scanner-secret");
  if (!secret || secret !== process.env.SCANNER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDB();
    const stats = await checkVerdictOutcomes(db);
    return NextResponse.json({ success: true, ...stats });
  } catch (err) {
    console.error("Verdict outcome check failed:", (err as Error).message);
    return NextResponse.json({ error: "Verdict outcome check failed" }, { status: 500 });
  }
}
