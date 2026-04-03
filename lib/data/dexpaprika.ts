/**
 * DexPaprika API — no API key required.
 * Use for: DEX token data, on-chain prices, liquidity pools on Base.
 * Free tier: 10,000 requests/day.
 * Covers: 500,000+ tokens across 30+ networks including Base.
 * Base URL: https://api.dexpaprika.com
 *
 * Supplements existing data (DexScreener) — never replaces.
 */

const DEXPAPRIKA_BASE = "https://api.dexpaprika.com";

const BASE_NETWORK = "base";

export type DexPaprikaToken = {
  id: string;
  name: string;
  symbol: string;
  networkId: string;
  address: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
};

export type DexPaprikaPool = {
  id: string;
  dexId: string;
  token0: { symbol: string; address: string };
  token1: { symbol: string; address: string };
  priceUsd: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  txCount24h: number;
};

export async function getDexPaprikaToken(
  contractAddress: string,
  network = BASE_NETWORK
): Promise<DexPaprikaToken | null> {
  try {
    const res = await fetch(
      `${DEXPAPRIKA_BASE}/networks/${network}/tokens/${contractAddress.toLowerCase()}`,
      { cf: { cacheTtl: 60, cacheEverything: true } } as any
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    // DexPaprika nests data in summary object
    const s = data.summary || {};
    const h24 = s["24h"] || {};

    return {
      id: data.id || "",
      name: data.name || "",
      symbol: data.symbol || "",
      networkId: data.chain || network,
      address: data.id || contractAddress,
      priceUsd: s.price_usd || 0,
      priceChange24h: h24.last_price_usd_change || 0,
      volume24h: h24.volume_usd || 0,
      liquidity: s.liquidity_usd || 0,
      fdv: s.fdv || data.fdv || 0,
    };
  } catch {
    return null;
  }
}

export async function getTopBasePools(limit = 10): Promise<DexPaprikaPool[]> {
  try {
    const res = await fetch(
      `${DEXPAPRIKA_BASE}/networks/${BASE_NETWORK}/pools?limit=${limit}&sort=volume_24h`,
      { cf: { cacheTtl: 300, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data.pools || []).map((p: any) => ({
      id: p.id,
      dexId: p.dex_id,
      token0: { symbol: p.token0?.symbol, address: p.token0?.address },
      token1: { symbol: p.token1?.symbol, address: p.token1?.address },
      priceUsd: p.price_usd || 0,
      volume24h: p.volume_24h || 0,
      liquidity: p.liquidity || 0,
      priceChange24h: p.price_change_24h || 0,
      txCount24h: p.tx_count_24h || 0,
    }));
  } catch {
    return [];
  }
}

export async function getClaudiaTokenData(): Promise<DexPaprikaToken | null> {
  const CLAUDIA_CONTRACT = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
  return getDexPaprikaToken(CLAUDIA_CONTRACT, BASE_NETWORK);
}

export function formatDexPaprikaContext(
  token: DexPaprikaToken | null
): string {
  if (!token) return "";

  return [
    "DEXPAPRIKA ON-CHAIN DATA:",
    `Price: $${token.priceUsd.toFixed(8)}`,
    `24h Change: ${token.priceChange24h.toFixed(2)}%`,
    `24h Volume: $${(token.volume24h / 1000).toFixed(0)}K`,
    `Liquidity: $${(token.liquidity / 1000).toFixed(0)}K`,
    `FDV: $${(token.fdv / 1000).toFixed(0)}K`,
  ].join("\n");
}
