import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const settings = await db
      .prepare("SELECT portfolio_context_enabled FROM portfolio_settings WHERE address = ?")
      .bind(session.address.toLowerCase())
      .first<{ portfolio_context_enabled: number }>();

    return NextResponse.json({
      enabled: settings?.portfolio_context_enabled === 1,
    });
  } catch (err) {
    console.error("Portfolio settings GET error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = (await req.json().catch(() => null)) as any;
    if (body?.enabled === undefined) {
      return NextResponse.json({ error: "Missing 'enabled' field" }, { status: 400 });
    }

    const db = getDB();
    await db
      .prepare(
        `INSERT INTO portfolio_settings (address, portfolio_context_enabled, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET
           portfolio_context_enabled = excluded.portfolio_context_enabled,
           updated_at = excluded.updated_at`
      )
      .bind(session.address.toLowerCase(), body.enabled ? 1 : 0, Date.now())
      .run();

    return NextResponse.json({ success: true, enabled: !!body.enabled });
  } catch (err) {
    console.error("Portfolio settings POST error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
