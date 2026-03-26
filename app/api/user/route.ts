import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth, requireTier } from "@/lib/marketplace/middleware";

/**
 * GET /api/user — Get user profile, tier, credits, and agent stats
 * Auth: required
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireMarketplaceAuth(req, { ratePrefix: "user", rateMax: 60 });
    if (auth instanceof NextResponse) return auth;

    const { user, db } = auth;

    // Refresh tier from on-chain balance
    await requireTier(db, user, "browse").catch(() => {});
    // Re-fetch user after tier update
    const freshUser = await db.prepare(
      "SELECT * FROM users WHERE address = ?"
    ).bind(user.address.toLowerCase()).first();

    // Get user's created agents count
    const agentCount = await db.prepare(
      "SELECT COUNT(*) as count FROM agents WHERE creator_address = ? AND status != 'deleted'"
    ).bind(user.address.toLowerCase()).first<{ count: number }>();

    // Get user's total agent usage (as creator)
    const totalUsage = await db.prepare(
      "SELECT COALESCE(SUM(usage_count), 0) as total FROM agents WHERE creator_address = ? AND status != 'deleted'"
    ).bind(user.address.toLowerCase()).first<{ total: number }>();

    return NextResponse.json({
      address: (freshUser as any)?.address ?? user.address,
      tier: (freshUser as any)?.tier ?? user.tier,
      credits: (freshUser as any)?.credits ?? user.credits,
      total_spent: (freshUser as any)?.total_spent ?? user.total_spent,
      total_earned: (freshUser as any)?.total_earned ?? user.total_earned,
      agents_created: agentCount?.count ?? 0,
      agents_total_usage: totalUsage?.total ?? 0,
      created_at: (freshUser as any)?.created_at ?? user.created_at,
    });
  } catch (err) {
    console.error("Get user error:", (err as Error).message);
    return NextResponse.json(
      { error: "Failed to get user profile" },
      { status: 500 }
    );
  }
}
