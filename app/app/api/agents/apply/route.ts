import { NextRequest, NextResponse } from "next/server";
import { requireAuth, rateLimit } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";

/**
 * POST /api/agents/apply — Submit creator application (waitlist signup)
 * Body: { contact: string } (email or telegram handle)
 * Auth: SIWE session only
 */
export async function POST(req: NextRequest) {
  try {
    const rlError = await rateLimit(req, "creator-apply", 5, 60_000);
    if (rlError) return rlError;

    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const contact = String((body as any).contact ?? "").trim();
    if (!contact || contact.length < 3 || contact.length > 200) {
      return NextResponse.json({ error: "Contact must be 3-200 characters" }, { status: 400 });
    }

    const db = getDB();
    await db.prepare(
      "INSERT OR REPLACE INTO creator_applications (address, contact) VALUES (?, ?)"
    ).bind(session.address.toLowerCase(), contact).run();

    return NextResponse.json({ message: "Application submitted" });
  } catch (err) {
    console.error("Creator apply error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
