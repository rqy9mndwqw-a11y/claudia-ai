/**
 * CoinPaprika API — no API key required for free tier.
 * Use for: market cap, fundamentals, token metadata, team data.
 * Free tier: 25,000 calls/month.
 * Base URL: https://api.coinpaprika.com/v1
 *
 * Supplements existing data (Polygon, DeFiLlama, DexScreener) — never replaces.
 */

const COINPAPRIKA_BASE = "https://api.coinpaprika.com/v1";

const CACHE_TTL = {
  price: 60,
  coin: 3600,
  global: 300,
};

// CoinPaprika uses format: btc-bitcoin, eth-ethereum, etc.
const TICKER_TO_ID: Record<string, string> = {
  BTC: "btc-bitcoin",
  ETH: "eth-ethereum",
  SOL: "sol-solana",
  BNB: "bnb-binance-coin",
  AVAX: "avax-avalanche",
  MATIC: "matic-polygon",
  LINK: "link-chainlink",
  UNI: "uni-uniswap",
  AAVE: "aave-aave",
  CRV: "crv-curve-dao-token",
  MKR: "mkr-maker",
  SNX: "snx-synthetix-network-token",
  COMP: "comp-compound",
  DOT: "dot-polkadot",
  NEAR: "near-near-protocol",
  FTM: "ftm-fantom",
  ALGO: "algo-algorand",
  ATOM: "atom-cosmos",
  LTC: "ltc-litecoin",
  BCH: "bch-bitcoin-cash",
};

export type CoinPaprikaPrice = {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  price: number;
  volume24h: number;
  marketCap: number;
  percentChange1h: number;
  percentChange24h: number;
  percentChange7d: number;
  percentChange30d: number;
  athPrice: number;
  athDate: string;
  betaValue: number;
};

export type CoinPaprikaCoin = {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  type: string;
  description: string;
  totalSupply: number;
  maxSupply: number;
  circulatingSupply: number;
  firstDataAt: string;
  whitepaper?: { link: string };
  links?: {
    website?: string[];
    twitter?: string[];
    github?: string[];
    telegram?: string[];
  };
  team?: Array<{
    id: string;
    name: string;
    position: string;
  }>;
  tags?: string[];
};

export type GlobalMarketData = {
  marketCapUsd: number;
  volume24hUsd: number;
  bitcoinDominancePercent: number;
  cryptocurrenciesNumber: number;
  marketCapChange24h: number;
  volume24hChange24h: number;
};

export async function getCoinPrice(
  ticker: string
): Promise<CoinPaprikaPrice | null> {
  const coinId = TICKER_TO_ID[ticker.toUpperCase()];
  if (!coinId) return null;

  try {
    const res = await fetch(`${COINPAPRIKA_BASE}/tickers/${coinId}`, {
      cf: { cacheTtl: CACHE_TTL.price, cacheEverything: true },
    } as any);
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const usd = data.quotes?.USD;

    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      rank: data.rank,
      price: usd?.price || 0,
      volume24h: usd?.volume_24h || 0,
      marketCap: usd?.market_cap || 0,
      percentChange1h: usd?.percent_change_1h || 0,
      percentChange24h: usd?.percent_change_24h || 0,
      percentChange7d: usd?.percent_change_7d || 0,
      percentChange30d: usd?.percent_change_30d || 0,
      athPrice: usd?.ath_price || 0,
      athDate: usd?.ath_date || "",
      betaValue: data.beta_value || 0,
    };
  } catch {
    return null;
  }
}

export async function getCoinMetadata(
  ticker: string
): Promise<CoinPaprikaCoin | null> {
  const coinId = TICKER_TO_ID[ticker.toUpperCase()];
  if (!coinId) return null;

  try {
    const res = await fetch(`${COINPAPRIKA_BASE}/coins/${coinId}`, {
      cf: { cacheTtl: CACHE_TTL.coin, cacheEverything: true },
    } as any);
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol,
      rank: data.rank,
      type: data.type,
      description: data.description,
      totalSupply: data.total_supply,
      maxSupply: data.max_supply,
      circulatingSupply: data.circulating_supply,
      firstDataAt: data.first_data_at,
      whitepaper: data.whitepaper,
      links: {
        website: data.links?.website,
        twitter: data.links?.twitter,
        github: data.links?.github,
        telegram: data.links?.telegram,
      },
      team: data.team?.map((member: any) => ({
        id: member.id,
        name: member.name,
        position: member.position,
      })),
      tags: data.tags?.map((tag: any) => tag.name),
    };
  } catch {
    return null;
  }
}

export async function getGlobalMarketData(): Promise<GlobalMarketData | null> {
  try {
    const res = await fetch(`${COINPAPRIKA_BASE}/global`, {
      cf: { cacheTtl: CACHE_TTL.global, cacheEverything: true },
    } as any);
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    return {
      marketCapUsd: data.market_cap_usd,
      volume24hUsd: data.volume_24h_usd,
      bitcoinDominancePercent: data.bitcoin_dominance_percentage,
      cryptocurrenciesNumber: data.cryptocurrencies_number,
      marketCapChange24h: data.market_cap_change_24h,
      volume24hChange24h: data.volume_24h_change_24h,
    };
  } catch {
    return null;
  }
}

export async function searchCoin(
  query: string
): Promise<Array<{ id: string; name: string; symbol: string; rank: number }>> {
  try {
    const res = await fetch(
      `${COINPAPRIKA_BASE}/search?q=${encodeURIComponent(query)}&c=currencies&limit=5`,
      { cf: { cacheTtl: CACHE_TTL.coin, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data.currencies || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      rank: c.rank,
    }));
  } catch {
    return [];
  }
}

export function formatCoinPaprikaContext(
  price: CoinPaprikaPrice | null,
  metadata: CoinPaprikaCoin | null
): string {
  if (!price && !metadata) return "";

  const f = (v: number | null | undefined, d = 2): string =>
    v != null && typeof v === "number" && !isNaN(v) ? v.toFixed(d) : "?";

  const lines: string[] = [];

  try {
    if (price) {
      lines.push("COINPAPRIKA MARKET DATA:");
      lines.push(`Price: $${price.price?.toLocaleString() ?? "?"}`);
      lines.push(`Market Cap: $${f(price.marketCap ? price.marketCap / 1e9 : null)}B`);
      lines.push(`24h Volume: $${f(price.volume24h ? price.volume24h / 1e6 : null, 0)}M`);
      lines.push(`Rank: #${price.rank ?? "?"}`);
      lines.push(`24h Change: ${f(price.percentChange24h)}%`);
      lines.push(`7d Change: ${f(price.percentChange7d)}%`);
      lines.push(`30d Change: ${f(price.percentChange30d)}%`);
      if (price.athPrice) {
        lines.push(`ATH: $${price.athPrice.toLocaleString()}`);
      }
      lines.push(`Beta (BTC correlation): ${f(price.betaValue)}`);
    }
  } catch {
    // CoinPaprika formatting failed — continue with whatever we have
  }

  if (metadata) {
    if (metadata.totalSupply) {
      lines.push("\nTOKENOMICS:");
      lines.push(`Total Supply: ${metadata.totalSupply.toLocaleString()}`);
      if (metadata.maxSupply) {
        lines.push(`Max Supply: ${metadata.maxSupply.toLocaleString()}`);
      }
      if (metadata.circulatingSupply) {
        lines.push(`Circulating: ${metadata.circulatingSupply.toLocaleString()}`);
        if (metadata.maxSupply) {
          const pct = ((metadata.circulatingSupply / metadata.maxSupply) * 100).toFixed(1);
          lines.push(`% Circulating: ${pct}%`);
        }
      }
    }

    if (metadata.team && metadata.team.length > 0) {
      lines.push(
        `\nTEAM: ${metadata.team
          .slice(0, 3)
          .map((m) => `${m.name} (${m.position})`)
          .join(", ")}`
      );
    }

    if (metadata.tags && metadata.tags.length > 0) {
      lines.push(`Tags: ${metadata.tags.slice(0, 5).join(", ")}`);
    }

    if (metadata.description) {
      lines.push(`\nDescription: ${metadata.description.slice(0, 200)}...`);
    }
  }

  return lines.join("\n");
}
