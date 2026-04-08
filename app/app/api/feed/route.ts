import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/marketplace/db";

/**
 * GET /api/feed
 * Public — no auth required. Returns paginated feed posts.
 *
 * Query params:
 *   limit: number (default 20, max 50)
 *   before: timestamp (epoch ms, for cursor pagination)
 *   type: 'agent_post' | 'alpha_alert' | 'market_scan' | 'all' (default 'all')
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 50);
  const before = parseInt(url.searchParams.get("before") || "0", 10) || 0;
  const type = url.searchParams.get("type") || "all";

  const validTypes = ["agent_post", "alpha_alert", "market_scan", "all"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }

  try {
    const db = getDB();

    let query: string;
    const params: any[] = [];

    if (type === "all") {
      if (before > 0) {
        query = `SELECT * FROM feed_posts WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`;
        params.push(before, limit + 1);
      } else {
        query = `SELECT * FROM feed_posts ORDER BY created_at DESC LIMIT ?`;
        params.push(limit + 1);
      }
    } else {
      if (before > 0) {
        query = `SELECT * FROM feed_posts WHERE post_type = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`;
        params.push(type, before, limit + 1);
      } else {
        query = `SELECT * FROM feed_posts WHERE post_type = ? ORDER BY created_at DESC LIMIT ?`;
        params.push(type, limit + 1);
      }
    }

    const result = await db.prepare(query).bind(...params).all() as any;
    const rows = result?.results || [];

    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit);
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].created_at : undefined;

    return NextResponse.json({
      posts,
      hasMore,
      ...(nextCursor && { nextCursor }),
    }, {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
    });
  } catch (err) {
    console.error("Feed fetch error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}
