import { NextRequest, NextResponse } from "next/server";
import { placeOrder, type ExchangeId } from "@/lib/exchange";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rlError = await rateLimit(req, "trade-exec", 10, 60_000);
    if (rlError) return rlError;

    // Auth + token gate
    const session = await requireAuthAndBalance(req, GATE_THRESHOLDS.trading, "trading");
    if (session instanceof NextResponse) return session;

    const { apiKey, apiSecret, exchange, symbol, side, amount, price, orderType, stopLoss, takeProfit } = await req.json() as any;

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
    console.error("Execute error:", msg);

    // Sanitize exchange errors — never expose raw exchange error codes to client
    let userError = "Trade failed. Please try again.";
    if (msg.includes("EOrder")) userError = "Order rejected. Check size and available balance.";
    else if (msg.includes("EAPI")) userError = "Exchange connection error. Try again.";
    else if (msg.includes("EGeneral")) userError = "Trade failed. Please try again.";
    else if (msg.includes("EFunding")) userError = "Insufficient funds for this trade.";
    else if (msg.includes("EService")) userError = "Exchange temporarily unavailable.";
    else if (msg.includes("Invalid")) userError = "Invalid trade parameters.";

    return NextResponse.json({ error: userError }, { status: 400 });
  }
}
