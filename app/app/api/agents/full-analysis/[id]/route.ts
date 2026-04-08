import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";

/**
 * GET /api/agents/full-analysis/:id — Fetch a saved full analysis
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await requireMarketplaceAuth(req, { ratePrefix: "analysis-get", rateMax: 30 });
    if (auth instanceof NextResponse) return auth;

    const { session, db } = auth;

    const row = await db.prepare(
      "SELECT * FROM full_analyses WHERE id = ? AND user_address = ?"
    ).bind(id, session.address.toLowerCase()).first();

    if (!row) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    return NextResponse.json({
      analysisId: (row as any).id,
      question: (row as any).question,
      agents: JSON.parse((row as any).agent_results),
      synthesis: JSON.parse((row as any).synthesis),
      claudiaVerdict: JSON.parse((row as any).claudia_verdict),
      creditsCharged: (row as any).credits_charged,
    });
  } catch (err) {
    console.error("Get analysis error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load analysis" }, { status: 500 });
  }
}
