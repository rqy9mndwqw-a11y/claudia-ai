import { NextRequest, NextResponse } from "next/server";

/**
 * Farcaster Mini App webhook — receives events when users
 * add/remove the app or enable/disable notifications.
 * Required by the manifest at /.well-known/farcaster.json.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Farcaster webhook:", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
