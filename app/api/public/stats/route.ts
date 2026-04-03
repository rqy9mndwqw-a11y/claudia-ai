import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";
import { rateLimit } from "@/lib/auth";
import { getClaudiaHoldersCount } from "@/lib/data/holders";
import { getPairData } from "@/lib/data/dexscreener";

/**
 * GET /api/public/stats — public platform stats.
 * No auth required. Cached 5 minutes.
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "public-stats", 30, 60_000);
    if (rl) return rl;

    const db = getDB();

    // Aerodrome WETH/CLAUDIA pool on Base
    const CLAUDIA_POOL = "0xe6be7cc04136ddada378175311fbd6424409f997";

    const [holders, claudiaPair, totalUsers, totalAgents, totalMessages, latestScan] =
      await Promise.all([
        getClaudiaHoldersCount().catch(() => null),
        getPairData("base", CLAUDIA_POOL).catch(() => null),
        db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM agents WHERE status IN ('active', 'coming_soon')").first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM chat_messages").first<{ count: number }>(),
        db.prepare("SELECT scanned_at, market_mood FROM market_scans ORDER BY scanned_at DESC LIMIT 1").first() as any,
      ]);

    // Holders history for growth chart (last 30 days)
    const holdersHistory = await db
      .prepare(
        "SELECT holders_count, recorded_date FROM holders_history ORDER BY recorded_date DESC LIMIT 30"
      )
      .all();

    return NextResponse.json(
      {
        holders: holders?.holdersCount || null,
        claudiaToken: claudiaPair
          ? {
              priceUsd: parseFloat(claudiaPair.priceUsd) || 0,
              priceChange24h: claudiaPair.priceChange?.h24 || 0,
              volume24h: claudiaPair.volume?.h24 || 0,
              liquidity: claudiaPair.liquidity?.usd || 0,
            }
          : null,
        totalUsers: totalUsers?.count || 0,
        totalAgents: totalAgents?.count || 0,
        totalMessages: totalMessages?.count || 0,
        lastScanAt: latestScan?.scanned_at || null,
        marketMood: latestScan?.market_mood || null,
        holdersHistory: (holdersHistory.results as any[]).reverse(),
      },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (err) {
    console.error("Stats error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
