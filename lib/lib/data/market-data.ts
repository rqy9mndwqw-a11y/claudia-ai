/**
 * Market data utilities — CoinGecko prices + ticker helpers.
 * Extracted from polygon.ts after migrating indicators to TAAPI
 * and economic data to FRED.
 */

// ── Cloudflare Cache API wrapper ──

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cache = (caches as any).default as Cache | undefined;
    if (cache) {
      const cacheKey = new Request(`https://claudia-cache/${key}`);
      const cached = await cache.match(cacheKey);
      if (cached) {
        // Check if cached response is still within TTL
        const cachedAt = cached.headers.get("x-cached-at");
        if (cachedAt) {
          const ageMs = Date.now() - Number(cachedAt);
          if (ageMs < ttlSeconds * 1000) {
            return await cached.json() as T;
          }
          // Expired — delete stale entry
          cache.delete(cacheKey);
        } else {
          // Legacy cached entry without timestamp — delete it
          cache.delete(cacheKey);
        }
      }

      const result = await fetcher();
      const response = new Response(JSON.stringify(result), {
        headers: {
          "Cache-Control": `public, max-age=${ttlSeconds}`,
          "x-cached-at": String(Date.now()),
        },
      });
      cache.put(cacheKey, response);
      return result;
    }
  } catch {
    // Cache unavailable — fall through to direct fetch
  }

  return fetcher();
}

// ── Common crypto pairs (same 41 as Python bot) ──

export const COMMON_CRYPTO_PAIRS = [
  // Majors
  "BTC/USD", "ETH/USD", "XRP/USD", "SOL/USD", "BNB/USD", "ADA/USD", "AVAX/USD",
  "DOT/USD", "LINK/USD", "ATOM/USD", "NEAR/USD", "SUI/USD", "APT/USD",
  // L1s
  "HBAR/USD", "ICP/USD", "FIL/USD", "ALGO/USD", "XLM/USD", "LTC/USD",
  "BCH/USD", "ETC/USD", "XMR/USD", "ZEC/USD", "KAS/USD", "TAO/USD",
  "SEI/USD", "TIA/USD", "TON/USD", "TRX/USD", "VET/USD",
  // L2 / Scaling
  "ARB/USD", "OP/USD", "POL/USD", "IMX/USD", "STRK/USD", "MANTA/USD",
  // DeFi
  "UNI/USD", "AAVE/USD", "MKR/USD", "CRV/USD", "SNX/USD", "COMP/USD",
  "LDO/USD", "PENDLE/USD", "ENA/USD", "JUP/USD", "RUNE/USD",
  // AI / Data
  "FET/USD", "RENDER/USD", "GRT/USD", "OCEAN/USD", "ONDO/USD",
  "WLD/USD", "AKT/USD", "AR/USD",
  // Infrastructure
  "INJ/USD", "STX/USD",
  // Gaming
  "GALA/USD", "AXS/USD", "SAND/USD",
  // Meme
  "DOGE/USD", "PEPE/USD", "SHIB/USD", "WIF/USD", "BONK/USD", "FLOKI/USD",
];

// Known ticker symbols for extraction from user messages
const TICKER_SYMBOLS = new Set(
  COMMON_CRYPTO_PAIRS.map((p) => p.split("/")[0])
);

// ── CoinGecko for real-time prices (free, no key) ──

const COINGECKO_IDS: Record<string, string> = {
  "BTC/USD": "bitcoin", "ETH/USD": "ethereum", "SOL/USD": "solana",
  "XRP/USD": "ripple", "ADA/USD": "cardano", "AVAX/USD": "avalanche-2",
  "DOT/USD": "polkadot", "LINK/USD": "chainlink", "ATOM/USD": "cosmos",
  "UNI/USD": "uniswap", "AAVE/USD": "aave", "NEAR/USD": "near",
  "LTC/USD": "litecoin", "DOGE/USD": "dogecoin", "BCH/USD": "bitcoin-cash",
  "ARB/USD": "arbitrum", "OP/USD": "optimism", "FIL/USD": "filecoin",
  "GRT/USD": "the-graph", "MKR/USD": "maker", "COMP/USD": "compound-governance-token",
  "CRV/USD": "curve-dao-token", "SNX/USD": "havven", "INJ/USD": "injective-protocol",
  "SUI/USD": "sui", "PEPE/USD": "pepe", "RENDER/USD": "render-token",
  "FET/USD": "fetch-ai", "APT/USD": "aptos", "SEI/USD": "sei-network",
  "TIA/USD": "celestia", "ALGO/USD": "algorand", "XLM/USD": "stellar",
  "HBAR/USD": "hedera-hashgraph", "ICP/USD": "internet-computer",
  "RUNE/USD": "thorchain", "TAO/USD": "bittensor",
  "ZEC/USD": "zcash", "XMR/USD": "monero", "KAS/USD": "kaspa", "POL/USD": "polygon-ecosystem-token",
};

/** Get real-time prices from CoinGecko. Cached 2 minutes. Fetches in batches of 20 to avoid rate limits. */
export async function getCurrentPrices(pairs: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const validPairs = pairs.filter((p) => COINGECKO_IDS[p]);
  if (validPairs.length === 0) return results;

  // Batch into groups of 20 to stay under CoinGecko free tier limits
  const batchSize = 20;
  for (let i = 0; i < validPairs.length; i += batchSize) {
    const batch = validPairs.slice(i, i + batchSize);
    const ids = batch.map((p) => COINGECKO_IDS[p]);
    const key = `prices:${ids.sort().join(",")}`;

    try {
      const batchPrices = await withCache(key, 120, async () => {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url, {
          headers: { "User-Agent": "CLAUDIA/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          if (res.status === 429) {
            // Rate limited — wait and retry once
            await new Promise((r) => setTimeout(r, 2000));
            const retry = await fetch(url, {
              headers: { "User-Agent": "CLAUDIA/1.0" },
              signal: AbortSignal.timeout(10000),
            });
            if (!retry.ok) return {};
            return await retry.json() as Record<string, { usd?: number }>;
          }
          return {};
        }
        return await res.json() as Record<string, { usd?: number }>;
      });

      for (const pair of batch) {
        const cgId = COINGECKO_IDS[pair];
        if (cgId && (batchPrices as any)[cgId]?.usd) {
          results[pair] = (batchPrices as any)[cgId].usd;
        }
      }
    } catch {}

    // Delay between CoinGecko batches
    if (i + batchSize < validPairs.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return results;
}

/** Current price for a single ticker (convenience). */
export async function getCurrentPrice(pair: string): Promise<number | null> {
  const prices = await getCurrentPrices([pair]);
  return prices[pair] ?? null;
}

/** Extract crypto tickers mentioned in a user message. */
export function extractTickers(message: string): string[] {
  const upper = message.toUpperCase();
  const found: string[] = [];

  // First pass: match known tickers from our list
  for (const sym of TICKER_SYMBOLS) {
    const regex = new RegExp(`\\b${sym}\\b`);
    if (regex.test(upper)) {
      found.push(`${sym}/USD`);
    }
  }

  // Second pass: if nothing found, try to extract any uppercase word
  // that looks like a ticker (2-10 alpha chars) — TAAPI will validate
  if (found.length === 0) {
    const words = upper.match(/\b[A-Z]{2,10}\b/g) || [];
    const skipWords = new Set([
      "THE", "AND", "FOR", "ARE", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
      "ONE", "OUR", "OUT", "HAS", "HIS", "HOW", "ITS", "MAY", "NEW", "NOW",
      "OLD", "SEE", "WAY", "WHO", "DID", "GET", "HAS", "HIM", "LET", "SAY",
      "SHE", "TOO", "USE", "WHAT", "WHEN", "WHY", "WILL", "WITH", "FULL",
      "ANALYSIS", "ANALYZE", "ABOUT", "PRICE", "TOKEN", "COIN", "MARKET",
      "TELL", "GIVE", "SHOW", "CHECK", "LOOK", "THINK", "SHOULD", "WOULD",
      "BUY", "SELL", "HOLD", "LONG", "SHORT", "RISK", "CHART", "RSI", "MACD",
    ]);
    for (const word of words) {
      if (!skipWords.has(word) && word.length >= 2 && word.length <= 10) {
        found.push(`${word}/USD`);
        break; // Take the first likely ticker
      }
    }
  }

  // Final fallback
  return found.length > 0 ? found : ["BTC/USD"];
}
