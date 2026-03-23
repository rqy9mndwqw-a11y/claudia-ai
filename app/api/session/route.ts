import { NextResponse } from "next/server";

/**
 * Returns a nonce/message for the client to sign.
 * This proves wallet ownership without requiring a full SIWE flow.
 */
export async function GET() {
  const nonce = crypto.randomUUID();
  const message = `Sign in to Claudia AI\n\nThis verifies you own this wallet. No gas, no transaction.\n\nNonce: ${nonce}`;
  return NextResponse.json({ message, nonce });
}
