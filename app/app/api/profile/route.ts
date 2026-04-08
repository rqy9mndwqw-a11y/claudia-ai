import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";

const VALID_PRESETS = ["default", "idle", "thinking", "excited", "skeptical", "talking"];

const BANNED_WORDS = ["nigger", "faggot", "chink", "spic", "kike"];
function containsBanned(text: string): boolean {
  return BANNED_WORDS.some((w) => text.toLowerCase().includes(w));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const profile = await db.prepare(
      "SELECT * FROM user_profiles WHERE address = ?"
    ).bind(session.address.toLowerCase()).first() as any;

    const stats = await db.prepare(`
      SELECT
        COUNT(DISTINCT activity_date) as total_active_days,
        COALESCE(SUM(credits_spent), 0) as total_credits_spent,
        MIN(created_at) as first_active
      FROM user_activity WHERE user_address = ?
    `).bind(session.address.toLowerCase()).first() as any;

    return NextResponse.json({
      address: session.address,
      displayName: profile?.display_name || null,
      tagline: profile?.tagline || null,
      xHandle: profile?.x_handle || null,
      avatarPreset: profile?.avatar_preset || "default",
      stats: {
        totalActiveDays: stats?.total_active_days || 0,
        totalCreditsSpent: stats?.total_credits_spent || 0,
        memberSince: stats?.first_active || null,
      },
    });
  } catch (err) {
    console.error("Profile GET error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const rl = await rateLimit(req, "profile-update", 5, 60_000);
    if (rl) return rl;

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const db = getDB();

    const displayName = body.displayName?.trim().slice(0, 32) || null;
    const tagline = body.tagline?.trim().slice(0, 80) || null;
    const xHandle = body.xHandle?.trim().replace("@", "").slice(0, 32) || null;
    const avatarPreset = VALID_PRESETS.includes(body.avatarPreset) ? body.avatarPreset : "default";

    if (displayName && containsBanned(displayName)) {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }
    if (tagline && containsBanned(tagline)) {
      return NextResponse.json({ error: "Invalid tagline" }, { status: 400 });
    }

    await db.prepare(`
      INSERT INTO user_profiles (address, display_name, tagline, x_handle, avatar_preset, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        display_name = excluded.display_name,
        tagline = excluded.tagline,
        x_handle = excluded.x_handle,
        avatar_preset = excluded.avatar_preset,
        updated_at = excluded.updated_at
    `).bind(
      session.address.toLowerCase(),
      displayName,
      tagline,
      xHandle,
      avatarPreset,
      Date.now(),
      Date.now()
    ).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Profile POST error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
