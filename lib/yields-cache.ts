/**
 * Server-side yield data cache (edge-compatible).
 * Fetches from DeFiLlama and caches for 5 minutes.
 */

export interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
}

let cachedPools: YieldPool[] = [];
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getYields(): Promise<YieldPool[]> {
  if (Date.now() < cacheExpiry && cachedPools.length > 0) {
    return cachedPools;
  }

  try {
    const res = await fetch("https://yields.llama.fi/pools");
    if (!res.ok) return cachedPools;

    const { data } = await res.json();

    cachedPools = data
      .filter(
        (p: any) =>
          p.chain === "Base" &&
          p.tvlUsd >= 1_000_000 &&
          typeof p.apy === "number" &&
          p.apy > 0 &&
          p.apy < 1000
      )
      .map((p: any) => ({
        pool: String(p.pool || ""),
        chain: "Base",
        project: String(p.project || "unknown"),
        symbol: String(p.symbol || "unknown"),
        tvlUsd: Number(p.tvlUsd) || 0,
        apy: Math.round((Number(p.apy) || 0) * 100) / 100,
        apyBase: p.apyBase ? Math.round(Number(p.apyBase) * 100) / 100 : null,
        apyReward: p.apyReward ? Math.round(Number(p.apyReward) * 100) / 100 : null,
        stablecoin: Boolean(p.stablecoin),
        ilRisk: String(p.ilRisk || "unknown"),
        exposure: String(p.exposure || "single"),
        poolMeta: p.poolMeta ? String(p.poolMeta) : null,
      }))
      .sort((a: YieldPool, b: YieldPool) => b.apy - a.apy)
      .slice(0, 50);

    cacheExpiry = Date.now() + CACHE_TTL;
  } catch {
    // Return stale or empty
  }

  return cachedPools;
}
