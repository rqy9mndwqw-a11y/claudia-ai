import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { createSessionToken } from "@/lib/session-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDB, getOrCreateUser } from "@/lib/marketplace/db";

/**
 * POST: Verify SIWE signature → issue session token.
 * The session token is HMAC-signed and contains the verified address.
 * All subsequent API requests use this token for auth.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(`auth:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many auth attempts" }, { status: 429 });
  }

  try {
    const { address, signature, message } = await req.json() as any;

    if (!address || !signature || !message) {
      return NextResponse.json({ error: "Missing authentication fields" }, { status: 400 });
    }

    // verifySession: checks signature, extracts + consumes nonce (single-use)
    const valid = await verifySession(address, signature, message);
    if (!valid) {
      return NextResponse.json(
        { error: "Signature verification failed. Request a new nonce and try again." },
        { status: 401 }
      );
    }

    // Issue session token — address is embedded and trusted from here on
    const token = await createSessionToken(address);

    // Ensure user exists in D1
    const db = getDB();
    await getOrCreateUser(db, address);

    return NextResponse.json({
      token,
      address: address.toLowerCase(),
    });
  } catch (err) {
    console.error("Session verify error:", (err as Error).message);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
