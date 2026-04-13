/**
 * Scanner universe builder.
 *
 * Replaces the hardcoded 75-pair list with a dynamic multi-source universe.
 * Merges:
 *   - CoinGecko top 50 by market cap
 *   - DexScreener Base trending (top 30 by 24h volume)
 *   - DexScreener Base gainers (1h, 4h)
 *   - CoinGecko 24h gainers (top 30 by pct change)
 *   - User watchlists (all rows in watchlist_tokens)
 *   - Recent Flashblocks launches (last 24h, rug_risk_score < 60)
 *
 * Cache: Cloudflare `caches.default` for the public API calls.
 * D1 reads (watchlist, flashblocks) are never cached — always fresh.
 *
 * Output: deduplicated by (address || symbol) with a tier + alert_source tag
 * so the scanner can prioritize when the universe exceeds its budget.
 */

export type AlertSource =
  | "top50"
  | "base_trending"
  | "gainer_1h"
  | "gainer_4h"
  | "gainer_24h"
  | "watchlist"
  | "launch";

export type TierLevel = 1 | 2 | 3;

export interface ScanTarget {
  /** Canonical symbol, uppercased, no $ prefix. */
  symbol: string;
  /** Contract address when known (lowercase). Null for CEX-only tokens. */
  address: string | null;
  /** Chain id from DexScreener / "eth" for CoinGecko majors. */
  chain: string | null;
  /** Where this token came from — badged on signal cards. */
  source: AlertSource;
  /** Priority: 1 = always scan, 2 = when capacity, 3 = spot check. */
  tier: TierLevel;
  /** Optional hints from the source — not authoritative, just priors. */
  price_usd?: number;
  price_change_1h?: number;
  price_change_4h?: number;
  price_change_24h?: number;
  volume_24h?: number;
  liquidity_usd?: number;
}

// ── Cache helpers (CF Workers cache.default) ──────────────────────────────

async function withCache<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const cache = (caches as any).default as Cache | undefined;
    if (cache) {
      const cacheKey = new Request(`https://scanner-universe/${key}`);
      const cached = await cache.match(cacheKey);
      if (cached) return (await cached.json()) as T;

      const result = await fn();
      cache.put(
        cacheKey,
        new Response(JSON.stringify(result), {
          headers: { "Cache-Control": `public, max-age=${ttlSec}` },
        })
      );
      return result;
    }
  } catch {
    // Cache misses / worker env without caches — fall through to fresh fetch
  }
  return fn();
}

async function safeFetchJson(url: string, timeoutMs = 10_000): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "CLAUDIA/1.0 scanner" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function norm(sym: string | undefined | null): string {
  return (sym || "").replace(/^\$/, "").trim().toUpperCase();
}

function addr(a: string | undefined | null): string | null {
  if (!a) return null;
  const s = a.toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(s) ? s : null;
}

// ── Source fetchers ───────────────────────────────────────────────────────

/** SOURCE 1 — CoinGecko top 50 by market cap. Cached 1h. */
export async function fetchCoinGeckoTop50(): Promise<ScanTarget[]> {
  return withCache("cg:top50", 3600, async () => {
    const data = await safeFetchJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false"
    );
    return (Array.isArray(data) ? data : []).map((c: any): ScanTarget => ({
      symbol: norm(c.symbol),
      address: null, // CoinGecko's `contract_address` is not on-chain-reliable
      chain: null,
      source: "top50",
      tier: 1,
      price_usd: c.current_price,
      price_change_24h: c.price_change_percentage_24h,
    }));
  });
}

/** SOURCE 2 — DexScreener Base top 30 by 24h volume. Cached 5 min. */
export async function fetchBaseTrending(): Promise<ScanTarget[]> {
  return withCache("dex:base_trending", 300, async () => {
    const data = await safeFetchJson(
      "https://api.dexscreener.com/latest/dex/search?q=WETH+base"
    );
    const pairs = (data?.pairs || []) as any[];
    const basePairs = pairs.filter((p) => p.chainId === "base" && p.baseToken?.address);
    basePairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
    return basePairs.slice(0, 30).map((p): ScanTarget => ({
      symbol: norm(p.baseToken.symbol),
      address: addr(p.baseToken.address),
      chain: "base",
      source: "base_trending",
      tier: 2,
      price_usd: Number(p.priceUsd) || undefined,
      price_change_1h: p.priceChange?.h1,
      price_change_24h: p.priceChange?.h24,
      volume_24h: p.volume?.h24,
      liquidity_usd: p.liquidity?.usd,
    }));
  });
}

/** SOURCE 3+4 — Base gainers 1h and 4h (shares the same pair pull). */
async function fetchBaseGainers(): Promise<{ h1: ScanTarget[]; h4: ScanTarget[] }> {
  return withCache("dex:base_gainers", 300, async () => {
    const data = await safeFetchJson(
      "https://api.dexscreener.com/latest/dex/search?q=WETH+base"
    );
    const pairs = (data?.pairs || []) as any[];
    // Require a minimum liquidity floor to exclude wash-trade noise
    const MIN_LIQ = 10_000;
    const eligible = pairs.filter(
      (p) =>
        p.chainId === "base" &&
        p.baseToken?.address &&
        (p.liquidity?.usd || 0) >= MIN_LIQ
    );

    const top = (key: "h1" | "h6", source: AlertSource): ScanTarget[] => {
      const copy = eligible.slice();
      copy.sort(
        (a, b) => (b.priceChange?.[key] || 0) - (a.priceChange?.[key] || 0)
      );
      return copy.slice(0, 20).map((p) => ({
        symbol: norm(p.baseToken.symbol),
        address: addr(p.baseToken.address),
        chain: "base",
        source,
        tier: 2 as TierLevel,
        price_usd: Number(p.priceUsd) || undefined,
        price_change_1h: p.priceChange?.h1,
        price_change_4h: p.priceChange?.h6, // DexScreener exposes h6, not h4 — closest proxy
        price_change_24h: p.priceChange?.h24,
        volume_24h: p.volume?.h24,
        liquidity_usd: p.liquidity?.usd,
      }));
    };

    // DexScreener doesn't expose h4 directly — use h6 as the 4h-window proxy.
    // The source tag still says "gainer_4h" so the UI badge stays readable.
    return { h1: top("h1", "gainer_1h"), h4: top("h6", "gainer_4h") };
  });
}

/** SOURCE 5 — CoinGecko 24h gainers, top 30. Cached 30 min. */
export async function fetchCoinGecko24hGainers(): Promise<ScanTarget[]> {
  return withCache("cg:gainers_24h", 1800, async () => {
    // CoinGecko's `price_change_percentage_24h_desc` requires a higher tier
    // key for reliable sort. Pull top 100 by volume and sort client-side.
    const data = await safeFetchJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h"
    );
    const rows = (Array.isArray(data) ? data : [])
      .filter((c: any) => typeof c.price_change_percentage_24h === "number")
      .sort(
        (a: any, b: any) =>
          (b.price_change_percentage_24h || 0) -
          (a.price_change_percentage_24h || 0)
      );
    return rows.slice(0, 30).map((c: any): ScanTarget => ({
      symbol: norm(c.symbol),
      address: null,
      chain: null,
      source: "gainer_24h",
      tier: 2,
      price_usd: c.current_price,
      price_change_24h: c.price_change_percentage_24h,
    }));
  });
}

/** SOURCE 6 — User watchlists. Always fresh. */
export async function fetchWatchlistTargets(db: D1Database): Promise<ScanTarget[]> {
  try {
    const rs = await db
      .prepare(
        `SELECT DISTINCT token_address, token_symbol
         FROM watchlist_tokens`
      )
      .all<{ token_address: string; token_symbol: string | null }>();
    return (rs.results || [])
      .map((r): ScanTarget | null => {
        const a = addr(r.token_address);
        if (!a) return null;
        return {
          symbol: norm(r.token_symbol),
          address: a,
          chain: "base",
          source: "watchlist",
          tier: 1, // Always scan — user explicitly opted in
        };
      })
      .filter(Boolean) as ScanTarget[];
  } catch (err) {
    console.error("[universe] watchlist read failed:", (err as Error).message);
    return [];
  }
}

/** SOURCE 7 — Recent Flashblocks launches (last 24h, low-risk). */
export async function fetchRecentLaunches(
  db: D1Database
): Promise<ScanTarget[]> {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rs = await db
      .prepare(
        `SELECT token_address, token_symbol
         FROM scanner_flashblock_launches
         WHERE detected_at_ms > ?
           AND (rug_risk_score IS NULL OR rug_risk_score < 60)
         ORDER BY detected_at_ms DESC
         LIMIT 30`
      )
      .bind(cutoff)
      .all<{ token_address: string; token_symbol: string | null }>();
    return (rs.results || [])
      .map((r): ScanTarget | null => {
        const a = addr(r.token_address);
        if (!a) return null;
        return {
          symbol: norm(r.token_symbol),
          address: a,
          chain: "base",
          source: "launch",
          tier: 3,
        };
      })
      .filter(Boolean) as ScanTarget[];
  } catch (err) {
    console.error("[universe] launches read failed:", (err as Error).message);
    return [];
  }
}

// ── Assembly ──────────────────────────────────────────────────────────────

export interface BuildOpts {
  /** Cap the final list. Default 150. Tier-priority kicks in above this. */
  maxTargets?: number;
}

export interface BuildResult {
  targets: ScanTarget[];
  /** Per-source counts for observability. */
  sourceCounts: Record<AlertSource, number>;
  /** Tokens that appeared in multiple sources — the first source wins, but
      knowing the duplicate count helps tune weights later. */
  dedupedCount: number;
}

/**
 * Pure assembly: merge, dedupe, tier-sort, cap. Extracted so tests don't
 * have to mock HTTP. buildScanUniverse() calls this after gathering sources.
 */
export function assembleUniverse(
  sources: ScanTarget[][],
  maxTargets = 150
): BuildResult {
  const all = sources.flat();

  const seen = new Set<string>();
  const unique: ScanTarget[] = [];
  const sourceCounts: Record<AlertSource, number> = {
    top50: 0,
    base_trending: 0,
    gainer_1h: 0,
    gainer_4h: 0,
    gainer_24h: 0,
    watchlist: 0,
    launch: 0,
  };
  let dedupedCount = 0;
  for (const t of all) {
    const key = t.address || t.symbol;
    if (!key) continue;
    if (seen.has(key)) {
      dedupedCount++;
      continue;
    }
    seen.add(key);
    unique.push(t);
    sourceCounts[t.source]++;
  }

  const byTier = (tier: TierLevel) => unique.filter((t) => t.tier === tier);
  const tiered = [...byTier(1), ...byTier(2), ...byTier(3)];
  return {
    targets: tiered.slice(0, maxTargets),
    sourceCounts,
    dedupedCount,
  };
}

/**
 * Build the scanner universe by merging all sources. Failures in any single
 * source log and are dropped — the rest still build a usable universe.
 *
 * Deduplication key: address when known, else uppercase symbol. First seen
 * wins; later sources are dropped (so Tier-1 watchlist tokens keep their
 * watchlist tag even if they also show up in trending).
 */
export async function buildScanUniverse(
  db: D1Database,
  opts: BuildOpts = {}
): Promise<BuildResult> {
  const maxTargets = opts.maxTargets ?? 150;

  const [top50, trending, gainers, gainers24h, watchlist, launches] =
    await Promise.allSettled([
      fetchCoinGeckoTop50(),
      fetchBaseTrending(),
      fetchBaseGainers(),
      fetchCoinGecko24hGainers(),
      fetchWatchlistTargets(db),
      fetchRecentLaunches(db),
    ]);

  const settled = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const gainerPair = settled(gainers, { h1: [], h4: [] });

  // Order matters — first source to introduce a token wins its tag.
  // Watchlist first (Tier 1, user intent), then top50 (Tier 1, broad market),
  // then trending, then gainers, then launches.
  return assembleUniverse(
    [
      settled(watchlist, []),
      settled(top50, []),
      settled(trending, []),
      gainerPair.h1,
      gainerPair.h4,
      settled(gainers24h, []),
      settled(launches, []),
    ],
    maxTargets
  );
}
