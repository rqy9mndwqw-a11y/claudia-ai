import sdk from "@farcaster/miniapp-sdk";

let initialized = false;

/**
 * Call after the app UI is fully rendered to dismiss the Farcaster splash screen.
 */
export async function initMiniApp(): Promise<void> {
  if (initialized) return;
  const inMiniApp = await isMiniApp();
  if (!inMiniApp) return;
  initialized = true;
  await sdk.actions.ready();
}

/**
 * Returns true when running inside a Farcaster Mini App host.
 */
export async function isMiniApp(): Promise<boolean> {
  try {
    return await sdk.isInMiniApp();
  } catch {
    return false;
  }
}

/**
 * Get the user's connected Ethereum address from the Farcaster embedded wallet.
 * Returns null if unavailable.
 */
export async function getFarcasterWalletAddress(): Promise<string | null> {
  try {
    const provider = await sdk.wallet.getEthereumProvider();
    if (!provider) return null;
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}
