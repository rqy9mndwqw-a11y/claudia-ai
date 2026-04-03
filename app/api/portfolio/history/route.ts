import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const url = new URL(req.url);
    const address = (url.searchParams.get("address") || session.address).toLowerCase();

    // Try Zerion chart first (real historical data, no snapshots needed)
    if (process.env.ZERION_API_KEY) {
      try {
        const { getZerionChart } = await import("@/lib/data/zerion");
        const chart = await getZerionChart(address, "month");
        if (chart && chart.length > 0) {
          return NextResponse.json({
            history: chart.map((p) => ({
              total_value_usd: p.value,
              snapshot_date: new Date(p.timestamp * 1000).toISOString().split("T")[0],
            })),
            source: "zerion",
          });
        }
      } catch {}
    }

    // Fallback to D1 snapshots
    const db = getDB();
    const history = await db
      .prepare("SELECT total_value_usd, snapshot_date FROM portfolio_snapshots WHERE address = ? ORDER BY snapshot_date ASC LIMIT 30")
      .bind(address)
      .all();

    return NextResponse.json({ history: history.results || [], source: "snapshots" });
  } catch (err) {
    console.error("Portfolio history error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
