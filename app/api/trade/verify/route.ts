import { NextRequest, NextResponse } from "next/server";
import { verifyExchangeKey, type ExchangeId } from "@/lib/exchange";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rlError = rateLimit(req, "trade-verify", 5, 60_000);
    if (rlError) return rlError;

    // Auth + token gate (100K CLAUDIA for trading features)
    const session = await requireAuthAndBalance(req, 100_000);
    if (session instanceof NextResponse) return session;

    const { apiKey, apiSecret, exchange } = await req.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "API key and secret required" }, { status: 400 });
    }

    const exchangeId: ExchangeId = exchange || "kraken";
    const { valid, balances } = await verifyExchangeKey(exchangeId, apiKey, apiSecret);

    if (!valid) {
      return NextResponse.json({ valid: false, error: "Invalid API credentials" });
    }

    return NextResponse.json({ valid: true, balances });
  } catch {
    return NextResponse.json({ valid: false, error: "Verification failed" });
  }
}
