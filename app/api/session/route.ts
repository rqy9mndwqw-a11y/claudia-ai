import { NextResponse } from "next/server";
import { storeNonce } from "@/lib/nonce-store";

/**
 * Returns a nonce/message for the client to sign.
 * The nonce is stored server-side and verified on use (single-use, 5min TTL).
 */
export async function GET() {
  const nonce = crypto.randomUUID();
  storeNonce(nonce);
  const message = `Sign in to Claudia AI\n\nThis verifies you own this wallet. No gas, no transaction.\n\nNonce: ${nonce}`;
  return NextResponse.json({ message, nonce });
}
