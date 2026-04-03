import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { rateLimit } from "@/lib/auth";
import { calculateLeaderboard } from "@/lib/leaderboard/calculate";

export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "public-leaderboard", 30, 60_000);
    if (rl) return rl;

    const db = getDB();
    const url = new URL(req.url);
    const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const entries = await calculateLeaderboard(db, month);
    const top10 = entries.slice(0, 10);

    const snapshot = await db.prepare(
      "SELECT * FROM leaderboard_snapshots WHERE month = ?"
    ).bind(month).first() as any;

    const [year, mo] = month.split("-").map(Number);
    const lastDay = new Date(year, mo, 0).getDate();

    return NextResponse.json({
      month,
      updatedAt: Date.now(),
      totalParticipants: entries.length,
      top10,
      airdropStatus: snapshot
        ? { distributed: !!snapshot.airdrop_tx, txHash: snapshot.airdrop_tx || null, amount: snapshot.airdrop_amount || null }
        : { distributed: false },
      nextSnapshot: `${month}-${lastDay}`,
    }, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("Leaderboard error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
