import { verifyMessage } from "viem";
import { consumeNonce } from "./nonce-store";

/**
 * Verify a SIWE signature and consume the nonce.
 *
 * Order: validate format → verify signature → consume nonce.
 * Nonce is consumed AFTER signature verification so a failed signature
 * doesn't burn a legitimate user's nonce.
 */
export async function verifySession(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    // Validate input formats
    if (!address || !signature || !message) return false;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    // Valid ETH signatures are 0x + 128 hex chars (65 bytes)
    if (!/^0x[a-fA-F0-9]{128,130}$/.test(signature)) return false;

    // Extract and validate nonce exists in message
    const nonceMatch = message.match(/Nonce:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (!nonceMatch) return false;
    const nonce = nonceMatch[1];

    // Validate domain binding
    if (!message.includes("URI: https://claudia.wtf")) return false;
    if (!message.includes("Chain ID: 8453")) return false;

    // Verify the signature matches the claimed address FIRST
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return false;

    // Only NOW consume the nonce — signature is valid, burn it
    if (!consumeNonce(nonce)) return false;

    return true;
  } catch {
    return false;
  }
}
