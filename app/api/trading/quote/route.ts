import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";
import { getBestPrice } from "@/lib/trading/route-scanner";

/**
 * POST /api/trading/quote — read-only best-price comparison across venues.
 *
 * Auth: wallet session (no credit cost for quotes — they're cheap server calls
 * and showing prices without charging builds trust for the future execute path).
 *
 * Body: { token_address, token_symbol, spend_usdc }
 * Returns: RouteScanResult with 0x + Kraken quotes and expires_at.
 *
 * EXECUTION IS NOT AVAILABLE HERE. The companion /api/trading/execute route
 * will return unsigned tx bytes for client signing once the security review
 * of wallet flow + Kraken key storage is complete.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMarketplaceAuth(req, {
    ratePrefix: "trading-quote",
    rateMax: 30,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as any;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token_address = String(body.token_address || "").trim();
  const token_symbol = String(body.token_symbol || "").trim();
  const spend_usdc = Number(body.spend_usdc);

  if (!token_address && !token_symbol) {
    return NextResponse.json(
      { error: "token_address or token_symbol required" },
      { status: 400 }
    );
  }
  if (!spend_usdc || !isFinite(spend_usdc) || spend_usdc <= 0) {
    return NextResponse.json(
      { error: "spend_usdc must be a positive number" },
      { status: 400 }
    );
  }
  if (spend_usdc > 100_000) {
    return NextResponse.json(
      { error: "spend_usdc too large (max 100,000 USDC per quote)" },
      { status: 400 }
    );
  }

  try {
    const result = await getBestPrice(token_address, token_symbol, spend_usdc);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/trading/quote] failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Quote failed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
