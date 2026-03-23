import { NextRequest, NextResponse } from "next/server";
import { placeOrder } from "@/lib/kraken";
import { verifyTokenBalance } from "@/lib/verify-token";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const rl = checkRateLimit(`exec:${ip}`, 10, 60_000); // 10 trades per minute max
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many trades. Slow down." }, { status: 429 });
    }

    const { address, apiKey, apiSecret, symbol, side, amount, price, orderType } = await req.json();

    // Validate inputs
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

    // Token gate
    try {
      const { authorized } = await verifyTokenBalance(address);
      if (!authorized) {
        return NextResponse.json({ error: "Insufficient $CLAUDIA balance." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Unable to verify token balance." }, { status: 503 });
    }

    // Execute the trade
    const result = await placeOrder(apiKey, apiSecret, {
      symbol: symbol.toUpperCase(),
      side,
      amount,
      price,
      orderType: orderType || "market",
    });

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      description: result.description,
    });
  } catch (err) {
    const msg = (err as Error).message;
    // Return Kraken errors to user (they're about their order, not our internals)
    if (msg.includes("EOrder") || msg.includes("EGeneral") || msg.includes("EAPI")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Execute error:", msg);
    return NextResponse.json({ error: "Trade execution failed. Check your API key permissions." }, { status: 500 });
  }
}
