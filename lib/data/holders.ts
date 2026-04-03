/**
 * Ankr API — free, no API key required.
 * Supports Base chain natively.
 * Returns exact holder count for $CLAUDIA token.
 */

const CLAUDIA_CONTRACT = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
const ANKR_BASE_URL = "https://rpc.ankr.com/multichain";

export type HoldersData = {
  holdersCount: number;
  fetchedAt: number;
};

export async function getClaudiaHoldersCount(): Promise<HoldersData | null> {
  try {
    const response = await fetch(ANKR_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ankr_getTokenHoldersCount",
        params: {
          blockchain: "base",
          contractAddress: CLAUDIA_CONTRACT,
        },
        id: 1,
      }),
      cf: { cacheTtl: 600, cacheEverything: true },
    } as any);

    if (!response.ok) return null;
    const data = (await response.json()) as any;

    return {
      holdersCount: data?.result?.holdersCount || 0,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
