import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, type SessionPayload } from "../session-token";
import { getDB, getOrCreateUser } from "./db";
import type { UserRow } from "./types";
import { TIER_THRESHOLDS, FEATURE_NAMES } from "../gate-thresholds";
import { verifyTokenBalance } from "../verify-token";
import { checkRateLimit } from "../rate-limit";

async function checkWalletRateLimit(
  address: string,
  prefix: string,
  maxRequests: number,
  windowMs: number
): Promise<NextResponse | null> {
  const rl = await checkRateLimit(`${prefix}:${address}`, maxRequests, windowMs);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return null;
}

export interface MarketplaceAuth {
  session: SessionPayload;
  user: UserRow;
  db: D1Database;
}

/**
 * Authenticate a marketplace request.
 * Returns the session, user record (created if needed), and D1 binding.
 */
export async function requireMarketplaceAuth(
  req: NextRequest,
  options: {
    ratePrefix: string;
    rateMax?: number;
    rateWindowMs?: number;
  }
): Promise<MarketplaceAuth | NextResponse> {
  // Extract Bearer token
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  // Per-wallet rate limit (D1-backed, works across isolates)
  const rlError = await checkWalletRateLimit(
    session.address,
    options.ratePrefix,
    options.rateMax ?? 30,
    options.rateWindowMs ?? 60_000
  );
  if (rlError) return rlError;

  // Get D1 and ensure user exists
  const db = getDB();
  const user = await getOrCreateUser(db, session.address);

  return { session, user, db };
}

/**
 * Require a minimum tier for an action.
 * Checks on-chain $CLAUDIA balance and updates the user's tier in D1.
 */
export async function requireTier(
  db: D1Database,
  user: UserRow,
  minimumTier: keyof typeof TIER_THRESHOLDS
): Promise<NextResponse | null> {
  const requiredBalance = TIER_THRESHOLDS[minimumTier];

  try {
    const { authorized, balance } = await verifyTokenBalance(user.address, requiredBalance);

    // Determine the user's actual tier based on balance
    let actualTier: UserRow["tier"] = "browse";
    if (balance >= TIER_THRESHOLDS.whale) actualTier = "whale";
    else if (balance >= TIER_THRESHOLDS.create) actualTier = "create";
    else if (balance >= TIER_THRESHOLDS.use) actualTier = "use";

    // Update tier in DB if changed
    if (actualTier !== user.tier) {
      const { updateUserTier } = await import("./db");
      await updateUserTier(db, user.address, actualTier);
      user.tier = actualTier;
    }

    if (!authorized) {
      return NextResponse.json(
        {
          error: "Insufficient CLAUDIA balance",
          required: requiredBalance,
          current: Math.floor(balance),
          feature: FEATURE_NAMES[`marketplace_${minimumTier}`] || "Agent Marketplace",
        },
        { status: 403 }
      );
    }

    return null; // Authorized
  } catch (err) {
    return NextResponse.json(
      { error: "Unable to verify token balance. Try again." },
      { status: 502 }
    );
  }
}
