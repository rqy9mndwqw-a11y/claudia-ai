import { verifyMessage } from "viem";
import { consumeNonce } from "./nonce-store";

/**
 * Verify that a wallet address actually signed the given message,
 * and that the nonce in the message was issued by us and hasn't been used.
 * The nonce is consumed (deleted) immediately — replay is impossible.
 */
export async function verifySession(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    if (!address || !signature || !message) return false;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    if (!/^0x[a-fA-F0-9]+$/.test(signature)) return false;

    // Extract nonce from the signed message
    const nonceMatch = message.match(/Nonce:\s*([a-f0-9-]+)/i);
    if (!nonceMatch) return false;

    const nonce = nonceMatch[1];

    // Consume the nonce BEFORE verifying the signature.
    // Even if signature check fails, the nonce is burned — no retry with
    // the same nonce possible.
    if (!consumeNonce(nonce)) return false;

    // Verify the signature matches the claimed address
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    return valid;
  } catch {
    return false;
  }
}
