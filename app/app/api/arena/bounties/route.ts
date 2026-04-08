import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    const active = await db.prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM bounty_attempts ba WHERE ba.bounty_id = b.id) as attempt_count
       FROM bounties b
       WHERE b.status = 'active' AND b.expires_at > ?
       ORDER BY b.reward_claudia DESC`
    ).bind(Math.floor(Date.now() / 1000)).all();

    const claimed = await db.prepare(
      `SELECT * FROM bounties WHERE status = 'claimed' ORDER BY claimed_at DESC LIMIT 10`
    ).all();

    return NextResponse.json({
      active: active.results || [],
      claimed: claimed.results || [],
    }, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (err) {
    console.error("Bounties error:", (err as Error).message);
    return NextResponse.json({ active: [], claimed: [] });
  }
}
