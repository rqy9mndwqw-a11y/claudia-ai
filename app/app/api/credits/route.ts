import { NextRequest, NextResponse } from "next/server";
import { requireAuth, rateLimit } from "@/lib/auth";
import { getDB, getOrCreateUser } from "@/lib/marketplace/db";
import { requireTier } from "@/lib/marketplace/middleware";

/**
 * GET /api/credits — Get current credit balance, tier, and recent transactions
 *
 * Auth: SIWE session only (no CLAUDIA balance required)
 * Rate limit: 30/min per IP
 */
export async function GET(req: NextRequest) {
  try {
    const rlError = await rateLimit(req, "credits-balance", 30, 60_000);
    if (rlError) return rlError;

    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const user = await getOrCreateUser(db, session.address);

    // Refresh tier from on-chain balance (updates D1 if changed)
    await requireTier(db, user, "browse").catch(() => {});

    // Re-fetch user after tier update
    const freshUser = await db.prepare(
      "SELECT address, tier, credits, total_spent, total_earned, created_at FROM users WHERE address = ?"
    ).bind(user.address.toLowerCase()).first();

    if (!freshUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get recent transactions (last 20)
    const transactions = await db.prepare(
      `SELECT id, amount, type, reference_id, balance_after, created_at
       FROM credit_transactions
       WHERE address = ?
       ORDER BY created_at DESC
       LIMIT 20`
    ).bind(user.address.toLowerCase()).all();

    return NextResponse.json({
      credits: (freshUser as any).credits,
      tier: (freshUser as any).tier,
      total_spent: (freshUser as any).total_spent,
      total_earned: (freshUser as any).total_earned,
      address: (freshUser as any).address,
      created_at: (freshUser as any).created_at,
      transactions: transactions.results,
    });
  } catch (err) {
    console.error("Get credits error:", (err as Error).message);
    return NextResponse.json(
      { error: "Failed to get credit balance" },
      { status: 500 }
    );
  }
}
