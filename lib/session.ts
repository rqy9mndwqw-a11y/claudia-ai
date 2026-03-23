import { verifyMessage } from "viem";

/**
 * Verify that a wallet address actually signed the given message.
 * Used to prevent address spoofing on /api/chat.
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

    const recovered = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    return recovered;
  } catch {
    return false;
  }
}
