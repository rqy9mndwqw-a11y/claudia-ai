import { NextRequest, NextResponse } from "next/server";
import { storeNonce } from "@/lib/nonce-store";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET: Returns a SIWE-style message with nonce for the client to sign.
 * POST: Verifies signature, consumes nonce, issues a session token.
 */
export async function GET(req: NextRequest) {
  // Rate limit nonce generation to prevent nonce flooding
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(`nonce:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const nonce = crypto.randomUUID();
  await storeNonce(nonce);

  // Structured SIWE-like message with domain binding
  const message = [
    "Claudia AI wants you to sign in with your Ethereum account.",
    "",
    "Sign in to access Claudia AI. This verifies wallet ownership.",
    "No gas fee, no transaction.",
    "",
    `URI: https://claudia.wtf`,
    `Chain ID: 8453`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");

  return NextResponse.json({ message, nonce });
}
