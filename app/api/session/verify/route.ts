import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { createSessionToken } from "@/lib/session-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDB, getOrCreateUser, addCreditsAtomic } from "@/lib/marketplace/db";
import { isWalletOldEnough } from "@/lib/utils/wallet-age";

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

    // Boost promo: 10 free credits for new wallets (one-time, expires 2026-04-06)
    let promoCredits = 0;
    const PROMO_END = new Date("2026-04-06T16:00:00Z").getTime(); // Sunday noon ET
    if (Date.now() < PROMO_END) {
      try {
        const db = getDB();
        await getOrCreateUser(db, address);
        const promoKey = `boost_promo:${address.toLowerCase()}`;
        const already = await db.prepare(
          "SELECT 1 FROM credit_transactions WHERE reference_id = ?"
        ).bind(promoKey).first();
        if (!already) {
          const oldEnough = await isWalletOldEnough(address, 30);
          if (oldEnough) {
            await addCreditsAtomic(db, address, 10, "bonus", promoKey);
            promoCredits = 10;
          }
        }
      } catch (err) {
        console.error("Promo credit drop failed:", (err as Error).message);
      }
    }

    return NextResponse.json({
      token,
      address: address.toLowerCase(),
      ...(promoCredits > 0 && { promoCredits }),
    });
  } catch (err) {
    console.error("Session verify error:", (err as Error).message);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
