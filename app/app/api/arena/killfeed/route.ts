import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    const since = req.nextUrl.searchParams.get("since");
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);

    let events;
    if (since) {
      events = await db.prepare(
        `SELECT id, type, message, color, created_at FROM killfeed_events
         WHERE created_at > ? ORDER BY created_at DESC LIMIT ?`
      ).bind(parseInt(since), limit).all();
    } else {
      events = await db.prepare(
        `SELECT id, type, message, color, created_at FROM killfeed_events
         ORDER BY created_at DESC LIMIT ?`
      ).bind(limit).all();
    }

    return NextResponse.json(
      { events: events.results || [] },
      { headers: { "Cache-Control": "public, max-age=10" } }
    );
  } catch (err) {
    console.error("Killfeed error:", (err as Error).message);
    return NextResponse.json({ events: [] });
  }
}
