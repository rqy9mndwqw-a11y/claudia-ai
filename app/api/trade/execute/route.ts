import { NextRequest, NextResponse } from "next/server";
import { placeOrder, type ExchangeId } from "@/lib/exchange";
import { verifyTokenBalance } from "@/lib/verify-token";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const rl = checkRateLimit(`exec:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many trades. Slow down." }, { status: 429 });
    }

    const { address, apiKey, apiSecret, exchange, symbol, side, amount, price, orderType, stopLoss, takeProfit } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Exchange API credentials required" }, { status: 400 });
    }
    if (!symbol || !side || !amount) {
      return NextResponse.json({ error: "Missing trade parameters" }, { status: 400 });
    }
    if (!["buy", "sell"].includes(side)) {
      return NextResponse.json({ error: "Side must be buy or sell" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    try {
      const { authorized } = await verifyTokenBalance(address, 100_000);
      if (!authorized) {
        return NextResponse.json({ error: "Insufficient $CLAUDIA balance." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Unable to verify token balance." }, { status: 503 });
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
