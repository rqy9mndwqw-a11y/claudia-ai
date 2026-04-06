let sdkModule: typeof import("@farcaster/miniapp-sdk") | null = null;

async function getSDK() {
  if (!sdkModule) {
    sdkModule = await import("@farcaster/miniapp-sdk");
  }
  return sdkModule.default;
}

/**
 * Call ASAP after UI renders to dismiss the Farcaster splash screen.
 * Must not be delayed by wallet fetches or other async work.
 */
export async function initMiniApp(): Promise<void> {
  try {
    const sdk = await getSDK();
    await sdk.actions.ready();
  } catch {
    // Not in Farcaster — ignore
  }
}

/**
 * Returns true when running inside a Farcaster Mini App host.
 */
export async function isMiniApp(): Promise<boolean> {
  try {
    const sdk = await getSDK();
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
    const sdk = await getSDK();
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

/**
 * Prompt the user to save CLAUDIA as a Mini App (enables notifications).
 */
export async function promptAddMiniApp(): Promise<boolean> {
  try {
    const sdk = await getSDK();
    await sdk.actions.addMiniApp();
    return true;
  } catch {
    return false;
  }
}
