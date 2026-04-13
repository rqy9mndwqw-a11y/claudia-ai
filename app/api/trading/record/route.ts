import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";
import { TRADE_EXECUTION_ENABLED } from "@/lib/trading/config";

/**
 * POST /api/trading/record
 *
 * Called by the client AFTER a successful on-chain broadcast to log the trade
 * into user_trades. This is a best-effort recorder — a failure here does NOT
 * roll back the tx (it's already on-chain). We just lose the analytics row.
 *
 * Why separate from /execute? /execute returns the unsigned tx BEFORE the
 * user confirms in their wallet. We can't know the final tx_hash until the
 * wallet broadcasts. A two-step flow is the only way to record accurately.
 *
 * Idempotency: user_trades.tx_hash has a UNIQUE constraint, so replaying the
 * same POST is a no-op (we return 200 without double-inserting).
 *
 * Auth: session wallet only. `wallet_address` in the body must match the
 * session (same binding as /execute).
 */

function isAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
}
function isTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}

export async function POST(req: NextRequest) {
  if (!TRADE_EXECUTION_ENABLED) {
    return NextResponse.json(
      { error: "Trade execution is disabled pending security review" },
      { status: 503 }
    );
  }

  const auth = await requireMarketplaceAuth(req, {
    ratePrefix: "trading-record",
    rateMax: 30,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;
  const { session, db } = auth;

  const body = (await req.json().catch(() => null)) as any;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const wallet_address = String(body.wallet_address || "").toLowerCase();
  const token_address = String(body.token_address || "").toLowerCase();
  const token_symbol = String(body.token_symbol || "").trim().toUpperCase().replace(/^\$/, "");
  const tx_hash = String(body.tx_hash || "").toLowerCase();
  const venue = String(body.venue || "dex_0x_base");
  const signal_id = body.signal_id ? String(body.signal_id).slice(0, 64) : null;
  const source_page = body.source_page ? String(body.source_page).slice(0, 32) : "direct";

  const spend_usdc = Number(body.spend_usdc);
  const tokens_received = Number(body.tokens_received);
  const effective_price = Number(body.effective_price);
  const price_impact_pct = body.price_impact_pct != null ? Number(body.price_impact_pct) : null;
  const gas_usd = body.gas_usd != null ? Number(body.gas_usd) : null;

  // Validation
  if (!isAddress(wallet_address)) return NextResponse.json({ error: "wallet_address invalid" }, { status: 400 });
  if (!isAddress(token_address)) return NextResponse.json({ error: "token_address invalid" }, { status: 400 });
  if (!isTxHash(tx_hash)) return NextResponse.json({ error: "tx_hash invalid" }, { status: 400 });
  if (!token_symbol || token_symbol.length > 15) return NextResponse.json({ error: "token_symbol required" }, { status: 400 });
  if (venue.length > 32) return NextResponse.json({ error: "venue too long" }, { status: 400 });

  if (wallet_address !== session.address.toLowerCase()) {
    return NextResponse.json({ error: "wallet_address must match session" }, { status: 403 });
  }

  if (!isFinite(spend_usdc) || spend_usdc <= 0) return NextResponse.json({ error: "spend_usdc invalid" }, { status: 400 });
  if (!isFinite(tokens_received) || tokens_received <= 0) return NextResponse.json({ error: "tokens_received invalid" }, { status: 400 });
  if (!isFinite(effective_price) || effective_price <= 0) return NextResponse.json({ error: "effective_price invalid" }, { status: 400 });

  try {
    await db
      .prepare(
        `INSERT INTO user_trades (wallet_address, token_address, token_symbol,
           venue, spend_usdc, tokens_received, effective_price, price_impact_pct,
           gas_usd, tx_hash, signal_id, source_page, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tx_hash) DO NOTHING`
      )
      .bind(
        wallet_address,
        token_address,
        token_symbol,
        venue,
        spend_usdc,
        tokens_received,
        effective_price,
        price_impact_pct,
        gas_usd,
        tx_hash,
        signal_id,
        source_page,
        new Date().toISOString()
      )
      .run();

    return NextResponse.json({ ok: true, tx_hash });
  } catch (err) {
    console.error("[trading/record] insert failed:", (err as Error).message);
    // Non-fatal — the tx is already on-chain. Return OK so the UI doesn't
    // confuse the user with a failure after a successful trade.
    return NextResponse.json(
      { ok: false, warning: "Logged to chain but not to analytics. This is safe — your trade succeeded." },
      { status: 200 }
    );
  }
}
