import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";

/**
 * GET /api/trading/history
 *
 * Session-scoped: always returns only the caller's own trades. The
 * wallet_address comes from the authenticated session, NEVER from a query
 * param. This prevents trivial history-enumeration attacks.
 *
 * Stays available even when TRADE_EXECUTION_ENABLED is off — users should
 * still be able to see their past trades if the feature is later disabled.
 *
 * Query params:
 *   token   (optional) filter to a single token_address
 *   limit   (optional, default 50, max 200)
 */

function isAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export async function GET(req: NextRequest) {
  const auth = await requireMarketplaceAuth(req, {
    ratePrefix: "trading-history",
    rateMax: 30,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;
  const { session, db } = auth;

  const url = req.nextUrl;
  const tokenFilter = (url.searchParams.get("token") || "").toLowerCase();
  const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 50 : limitRaw, 1), 200);

  if (tokenFilter && !isAddress(tokenFilter)) {
    return NextResponse.json({ error: "token must be a valid address" }, { status: 400 });
  }

  const wallet = session.address.toLowerCase();
  try {
    const rows = tokenFilter
      ? await db
          .prepare(
            `SELECT id, token_address, token_symbol, venue, spend_usdc,
                    tokens_received, effective_price, price_impact_pct,
                    gas_usd, tx_hash, signal_id, source_page, created_at
             FROM user_trades
             WHERE wallet_address = ? AND token_address = ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .bind(wallet, tokenFilter, limit)
          .all()
      : await db
          .prepare(
            `SELECT id, token_address, token_symbol, venue, spend_usdc,
                    tokens_received, effective_price, price_impact_pct,
                    gas_usd, tx_hash, signal_id, source_page, created_at
             FROM user_trades
             WHERE wallet_address = ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .bind(wallet, limit)
          .all();

    return NextResponse.json({ trades: rows.results || [] });
  } catch (err) {
    console.error("[trading/history] read failed:", (err as Error).message);
    return NextResponse.json({ trades: [], error: "History read failed" }, { status: 500 });
  }
}
