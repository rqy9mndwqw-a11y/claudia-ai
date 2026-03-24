import { NextRequest, NextResponse } from "next/server";
import { placeOrder, type ExchangeId } from "@/lib/exchange";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rlError = rateLimit(req, "trade-exec", 10, 60_000);
    if (rlError) return rlError;

    // Auth + token gate (100K CLAUDIA for trading features)
    const session = await requireAuthAndBalance(req, 100_000);
    if (session instanceof NextResponse) return session;

    const { apiKey, apiSecret, exchange, symbol, side, amount, price, orderType, stopLoss, takeProfit } = await req.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Exchange API credentials required" }, { status: 400 });
    }
    if (!symbol || !side || !amount) {
      return NextResponse.json({ error: "Missing trade parameters" }, { status: 400 });
    }
    if (!["buy", "sell"].includes(side)) {
      return NextResponse.json({ error: "Side must be buy or sell" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Invalid amount (must be 0 < amount <= 1,000,000)" }, { status: 400 });
    }
    if (price != null && (typeof price !== "number" || price <= 0)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    if (stopLoss != null && (typeof stopLoss !== "number" || stopLoss <= 0)) {
      return NextResponse.json({ error: "Invalid stop loss" }, { status: 400 });
    }
    if (takeProfit != null && (typeof takeProfit !== "number" || takeProfit <= 0)) {
      return NextResponse.json({ error: "Invalid take profit" }, { status: 400 });
    }

    const exchangeId: ExchangeId = exchange || "kraken";

    const result = await placeOrder(exchangeId, apiKey, apiSecret, {
      symbol: symbol.toUpperCase(),
      side,
      amount,
      price,
      orderType: orderType || "market",
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
    });

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      description: result.description,
      closeDescription: result.closeDescription,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("EOrder") || msg.includes("EGeneral") || msg.includes("EAPI") || msg.includes("Invalid")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Execute error:", msg);
    return NextResponse.json({ error: "Trade execution failed. Check your API key permissions." }, { status: 500 });
  }
}
