import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, type SessionPayload } from "./session-token";
import { verifyTokenBalance } from "./verify-token";
import { checkRateLimit } from "./rate-limit";
import { GATE_THRESHOLDS, FEATURE_NAMES } from "./gate-thresholds";

/**
 * Authenticate a request using the session token.
 * Returns the verified session payload (with trusted address)
 * or a NextResponse error.
 */
export async function requireAuth(
  req: NextRequest
): Promise<SessionPayload | NextResponse> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required. Connect your wallet." },
      { status: 401 }
    );
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json(
      { error: "Session expired or invalid. Please reconnect your wallet." },
      { status: 401 }
    );
  }

  return session;
}

/**
 * Authenticate + verify CLAUDIA token balance.
 * Returns session payload or error response with structured threshold info.
 */
export async function requireAuthAndBalance(
  req: NextRequest,
  minBalance: number = GATE_THRESHOLDS.dashboard,
  feature?: string
): Promise<SessionPayload | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  try {
    const { authorized, balance } = await verifyTokenBalance(result.address, minBalance);
    if (!authorized) {
      const featureName = feature
        || Object.entries(GATE_THRESHOLDS).find(([, v]) => v === minBalance)?.[0]
        || "this feature";
      return NextResponse.json(
        {
          error: "Insufficient CLAUDIA balance",
          required: minBalance,
          current: Math.floor(balance),
          feature: FEATURE_NAMES[featureName] || featureName,
        },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to verify token balance. Try again." },
      { status: 503 }
    );
  }

  return result;
}

/**
 * Rate limit by IP (D1-backed, works across isolates).
 * Returns error response or null if allowed.
 */
export async function rateLimit(
  req: NextRequest,
  prefix: string,
  maxRequests = 20,
  windowMs = 60_000
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const rl = await checkRateLimit(`${prefix}:${ip}`, maxRequests, windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  return null;
}
