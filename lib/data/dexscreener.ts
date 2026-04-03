/**
 * DexScreener API — free, no key required.
 * Used by Memecoin Radar agent for trending pairs and token lookup.
 */

const BASE_URL = "https://api.dexscreener.com";

export interface TokenPair {
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { symbol: string };
  priceUsd: string;
  priceChange: { h1: number; h6: number; h24: number };
  volume: { h24: number };
  liquidity: { usd: number };
  txns: { h24: { buys: number; sells: number } };
  url: string;
}

async function dexFetch(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "User-Agent": "CLAUDIA/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DexScreener ${res.status}: ${endpoint}`);
  return res.json();
}

async function withDexCache<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  try {
    const cache = (caches as any).default as Cache | undefined;
    if (cache) {
      const cacheKey = new Request(`https://dex-cache/${key}`);
      const cached = await cache.match(cacheKey);
      if (cached) return await cached.json() as T;

      const result = await fn();
      cache.put(cacheKey, new Response(JSON.stringify(result), {
        headers: { "Cache-Control": `public, max-age=${ttl}` },
      }));
      return result;
    }
  } catch {}
  return fn();
}

/** Get top pairs on a chain by volume. Cached 2 minutes. */
export async function getTrendingPairs(chainId = "base", limit = 20): Promise<TokenPair[]> {
  return withDexCache(`trending:${chainId}`, 120, async () => {
    // Search for WETH pairs on the target chain — best proxy for trending
    const data = await dexFetch(`/latest/dex/search?q=WETH+${chainId}`);
    const pairs = (data?.pairs || []) as TokenPair[];
    return pairs
      .filter((p) => p.liquidity?.usd > 10000 && (p as any).chainId === chainId)
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, limit);
  });
}

/** Search for a token by name or symbol. Cached 1 minute. */
export async function searchToken(query: string): Promise<TokenPair[]> {
  return withDexCache(`search:${query.toLowerCase()}`, 60, async () => {
    const data = await dexFetch(`/latest/dex/search?q=${encodeURIComponent(query)}`);
    return (data?.pairs || []).slice(0, 10) as TokenPair[];
  });
}

/** Get pair data by address. Cached 30 seconds. */
export async function getPairData(chainId: string, pairAddress: string): Promise<TokenPair | null> {
  return withDexCache(`pair:${chainId}:${pairAddress}`, 30, async () => {
    const data = await dexFetch(`/latest/dex/pairs/${chainId}/${pairAddress}`);
    return data?.pair || data?.pairs?.[0] || null;
  });
}
