import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";
import { calculateLeaderboard, MIN_CREDITS_SPENT, MIN_ACTIVE_DAYS } from "@/lib/leaderboard/calculate";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const month = new Date().toISOString().slice(0, 7);

    const entries = await calculateLeaderboard(db, month);
    const myEntry = entries.find(
      (e) => e.address.toLowerCase() === session.address.toLowerCase()
    );

    // Get raw stats for progress tracking even if not qualified
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const rawStats = await db.prepare(`
      SELECT
        COALESCE(SUM(credits_spent), 0) as total_credits,
        COUNT(DISTINCT activity_date) as active_days
      FROM user_activity
      WHERE LOWER(user_address) = ?
      AND activity_date >= ? AND activity_date <= ?
    `).bind(session.address.toLowerCase(), monthStart, monthEnd).first() as any;

    return NextResponse.json({
      rank: myEntry?.rank || null,
      totalParticipants: entries.length,
      entry: myEntry || null,
      isTop10: myEntry ? myEntry.rank <= 10 : false,
      qualified: !!myEntry,
      rawCredits: rawStats?.total_credits || 0,
      rawActiveDays: rawStats?.active_days || 0,
      progress: !myEntry
        ? {
            creditsNeeded: Math.max(0, MIN_CREDITS_SPENT - (rawStats?.total_credits || 0)),
            daysNeeded: Math.max(0, MIN_ACTIVE_DAYS - (rawStats?.active_days || 0)),
          }
        : null,
    });
  } catch (err) {
    console.error("Leaderboard me error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load rank" }, { status: 500 });
  }
}
