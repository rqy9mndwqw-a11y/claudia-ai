import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/kraken";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, apiSecret } = await req.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "API key and secret required" }, { status: 400 });
    }

    const { valid, balances } = await verifyApiKey(apiKey, apiSecret);

    if (!valid) {
      return NextResponse.json({ valid: false, error: "Invalid API credentials" });
    }

    return NextResponse.json({ valid: true, balances });
  } catch (err) {
    return NextResponse.json({ valid: false, error: "Verification failed" });
  }
}
