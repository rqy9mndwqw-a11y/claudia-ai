import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Public endpoint — no auth required

function getBurnRank(total: number): { rank: string; color: string } {
  if (total >= 250_000) return { rank: "Eternal Flame", color: "#ffd700" };
  if (total >= 50_000) return { rank: "Inferno", color: "#ff4500" };
  if (total >= 10_000) return { rank: "Torch", color: "#ff8c00" };
  return { rank: "Spark", color: "#94a3b8" };
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    // All-time top 100 burners from credit transactions
    const allTime = await db.prepare(`
      SELECT
        user_address as wallet_address,
        SUM(amount) as total_burned,
        COUNT(*) as burn_count
      FROM credit_transactions
      WHERE type = 'purchase'
      GROUP BY user_address
      ORDER BY total_burned DESC
      LIMIT 100
    `).all();

    // Season burners (last 30 days)
    const seasonCutoff = Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const season = await db.prepare(`
      SELECT
        user_address as wallet_address,
        SUM(amount) as season_burned,
        COUNT(*) as burn_count
      FROM credit_transactions
      WHERE type = 'purchase' AND created_at > ?
      GROUP BY user_address
      ORDER BY season_burned DESC
      LIMIT 20
    `).bind(seasonCutoff).all();

    // Total burned across all wallets
    const totalResult = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM credit_transactions
      WHERE type = 'purchase'
    `).first();

    const allTimeEntries = (allTime.results || []).map((r: any, i: number) => {
      const addr = r.wallet_address || "";
      const total = r.total_burned || 0;
      const { rank, color } = getBurnRank(total);
      return {
        rank: i + 1,
        walletAddress: addr,
        walletShort: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
        totalBurned: total,
        burnCount: r.burn_count || 0,
        hallOfFlameRank: rank,
        rankColor: color,
      };
    });

    const seasonEntries = (season.results || []).map((r: any, i: number) => {
      const addr = r.wallet_address || "";
      const total = r.season_burned || 0;
      const { rank, color } = getBurnRank(total);
      return {
        rank: i + 1,
        walletAddress: addr,
        walletShort: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
        seasonBurned: total,
        burnCount: r.burn_count || 0,
        hallOfFlameRank: rank,
        rankColor: color,
      };
    });

    return NextResponse.json({
      allTime: allTimeEntries,
      season: seasonEntries,
      totalBurned: totalResult?.total || 0,
    }, {
      headers: { "Cache-Control": "public, max-age=300" }, // 5min cache
    });
  } catch (err) {
    console.error("Burn leaderboard error:", (err as Error).message);
    return NextResponse.json({ allTime: [], season: [], totalBurned: 0 });
  }
}
