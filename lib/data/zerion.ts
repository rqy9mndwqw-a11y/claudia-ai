/**
 * Zerion API — portfolio data, token positions, DeFi, NFTs, transactions, PnL.
 * Auth: Basic auth with `btoa(apiKey + ':')` — non-standard, colon required.
 * Responses follow JSON:API spec — data nested under `attributes`.
 * Free tier: 100 req/min.
 */

const ZERION_BASE = "https://api.zerion.io/v1";
const CLAUDIA_CONTRACT = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

function zerionHeaders(): Record<string, string> {
  const apiKey = process.env.ZERION_API_KEY || "";
  if (!apiKey) return { accept: "application/json" };
  return {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    accept: "application/json",
  };
}

function hasKey(): boolean {
  return !!(process.env.ZERION_API_KEY);
}

// ── Types (matching existing PortfolioData interface) ──

import type {
  PortfolioData,
  TokenBalance,
  NFTItem,
  DeFiPosition,
  Transaction,
} from "@/lib/portfolio/fetch-portfolio";

// ── Portfolio Summary ──

export async function getZerionPortfolio(address: string): Promise<{
  totalUsd: number;
  change1dUsd: number;
  change1dPct: number;
  byChain: Record<string, number>;
} | null> {
  if (!hasKey()) return null;

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/portfolio?filter[positions]=no_filter&currency=usd`,
      { headers: zerionHeaders(), cf: { cacheTtl: 60, cacheEverything: true } } as any
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const a = json.data?.attributes;
    if (!a) return null;

    return {
      totalUsd: a.total?.positions ?? 0,
      change1dUsd: a.changes?.absolute_1d ?? 0,
      change1dPct: a.changes?.percent_1d ?? 0,
      byChain: a.positions_distribution_by_chain ?? {},
    };
  } catch {
    return null;
  }
}

// ── Token Positions ──

export async function getZerionTokens(address: string): Promise<TokenBalance[]> {
  if (!hasKey()) return [];

  try {
    const params = new URLSearchParams({
      "filter[position_types]": "wallet",
      "filter[trash]": "only_non_trash",
      currency: "usd",
      sort: "-value",
      "page[size]": "100",
    });

    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/positions?${params}`,
      { headers: zerionHeaders(), cf: { cacheTtl: 60, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const items = json.data || [];

    return items
      .map((item: any): TokenBalance | null => {
        const a = item.attributes;
        if (!a) return null;
        const fi = a.fungible_info;
        const impl = fi?.implementations?.[0];
        const chainId = impl?.chain_id || "base";

        return {
          chain: chainId,
          chainName: formatChainId(chainId),
          contractAddress: impl?.address || "native",
          symbol: fi?.symbol || "???",
          name: fi?.name || fi?.symbol || "Unknown",
          balance: String(a.quantity?.float ?? 0),
          balanceUsd: a.value ?? 0,
          price: a.price ?? 0,
          priceChange24h: a.changes?.percent_1d ?? 0,
          thumbnail: fi?.icon?.url || undefined,
          isNative: !impl?.address,
        };
      })
      .filter((t: TokenBalance | null): t is TokenBalance => t !== null && t.balanceUsd > 0.01);
  } catch {
    return [];
  }
}

// ── DeFi Positions ──

export async function getZerionDeFi(address: string): Promise<DeFiPosition[]> {
  if (!hasKey()) return [];

  try {
    const params = new URLSearchParams({
      "filter[position_types]": "deposit,staked,locked",
      currency: "usd",
      "page[size]": "100",
    });

    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/positions?${params}`,
      { headers: zerionHeaders(), cf: { cacheTtl: 120, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const items = json.data || [];

    return items
      .map((item: any): DeFiPosition | null => {
        const a = item.attributes;
        if (!a || !a.value) return null;
        const protocol = item.relationships?.dapp?.data?.id || "unknown";
        const posType = a.position_type;

        return {
          chain: a.fungible_info?.implementations?.[0]?.chain_id || "base",
          protocol,
          type: posType === "deposit" ? "lending" : posType === "staked" ? "staking" : posType === "locked" ? "staking" : "other",
          tokenA: a.fungible_info?.symbol || undefined,
          tokenB: undefined,
          valueUsd: a.value,
          apr: undefined,
        };
      })
      .filter((d: DeFiPosition | null): d is DeFiPosition => d !== null && d.valueUsd > 0.01);
  } catch {
    return [];
  }
}

// ── NFTs ──

export async function getZerionNFTs(address: string): Promise<NFTItem[]> {
  if (!hasKey()) return [];

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/nft-positions?currency=usd&page[size]=50`,
      { headers: zerionHeaders(), cf: { cacheTtl: 300, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const items = json.data || [];

    return items.map((item: any): NFTItem => {
      const a = item.attributes;
      const nft = a?.nft_info;
      const col = a?.collection_info;

      return {
        chain: nft?.chain || "base",
        contractAddress: nft?.contract_address || "",
        tokenId: nft?.token_id || "0",
        name: nft?.name || `#${nft?.token_id || "?"}`,
        collection: col?.name || "Unknown Collection",
        imageUrl: nft?.content?.preview?.url || nft?.content?.icon?.url || undefined,
      };
    });
  } catch {
    return [];
  }
}

// ── Transactions ──

export async function getZerionTransactions(address: string): Promise<Transaction[]> {
  if (!hasKey()) return [];

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/transactions?currency=usd&page[size]=20&filter[operation_types]=trade,send,receive`,
      { headers: zerionHeaders(), cf: { cacheTtl: 120, cacheEverything: true } } as any
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const items = json.data || [];

    return items.map((item: any): Transaction => {
      const a = item.attributes;
      const transfer = a?.transfers?.[0];

      return {
        hash: a?.hash || "",
        chain: "base",
        timestamp: a?.mined_at ? new Date(a.mined_at).getTime() : Date.now(),
        type: a?.operation_type === "trade" ? "swap" : a?.operation_type === "send" ? "send" : "receive",
        fromAddress: "",
        toAddress: "",
        valueUsd: transfer?.value ?? 0,
        tokenSymbol: transfer?.fungible_info?.symbol || undefined,
        description: buildDescription(a),
      };
    });
  } catch {
    return [];
  }
}

// ── Portfolio Chart ──

export async function getZerionChart(
  address: string,
  period: "day" | "week" | "month" | "year" = "month"
): Promise<Array<{ timestamp: number; value: number }> | null> {
  if (!hasKey()) return null;

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/charts/portfolio?currency=usd&period=${period}`,
      { headers: zerionHeaders(), cf: { cacheTtl: 300, cacheEverything: true } } as any
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const points = json.data?.attributes?.points || [];

    return points.map((p: [number, number]) => ({
      timestamp: p[0],
      value: p[1],
    }));
  } catch {
    return null;
  }
}

// ── Full Portfolio Fetch (replaces Ankr fetchPortfolio) ──

export async function fetchZerionPortfolio(address: string): Promise<PortfolioData> {
  const [summary, tokens, defi, nfts, transactions] = await Promise.allSettled([
    getZerionPortfolio(address),
    getZerionTokens(address),
    getZerionDeFi(address),
    getZerionNFTs(address),
    getZerionTransactions(address),
  ]);

  const tokenList = tokens.status === "fulfilled" ? tokens.value : [];
  const nftList = nfts.status === "fulfilled" ? nfts.value : [];
  const defiList = defi.status === "fulfilled" ? defi.value : [];
  const txList = transactions.status === "fulfilled" ? transactions.value : [];
  const summaryData = summary.status === "fulfilled" ? summary.value : null;

  const totalValueUsd = summaryData?.totalUsd ?? tokenList.reduce((s, t) => s + t.balanceUsd, 0);
  const change24hUsd = summaryData?.change1dUsd ?? 0;
  const change24hPct = summaryData?.change1dPct ?? 0;

  const claudiaToken = tokenList.find(
    (t) => t.contractAddress.toLowerCase() === CLAUDIA_CONTRACT.toLowerCase()
  );

  const chains = summaryData?.byChain
    ? Object.keys(summaryData.byChain).filter((c) => (summaryData.byChain[c] ?? 0) > 0)
    : [...new Set(tokenList.map((t) => t.chain))];

  return {
    address,
    totalValueUsd,
    change24hUsd,
    change24hPct,
    tokens: tokenList.sort((a, b) => b.balanceUsd - a.balanceUsd),
    nfts: nftList,
    defi: defiList,
    transactions: txList,
    fetchedAt: Date.now(),
    chains,
    hasClaudia: !!claudiaToken,
    claudiaBalance: claudiaToken ? parseFloat(claudiaToken.balance) : undefined,
  };
}

// ── Helpers ──

function formatChainId(chainId: string): string {
  const names: Record<string, string> = {
    base: "Base", ethereum: "Ethereum", polygon: "Polygon",
    arbitrum: "Arbitrum", optimism: "Optimism",
    avalanche: "Avalanche", "binance-smart-chain": "BNB Chain",
  };
  return names[chainId] || chainId;
}

function buildDescription(attrs: any): string {
  const op = attrs?.operation_type;
  const transfer = attrs?.transfers?.[0];
  const symbol = transfer?.fungible_info?.symbol || "tokens";
  const qty = transfer?.quantity?.float;
  const qtyStr = qty ? Number(qty).toFixed(4) : "";

  if (op === "send") return `Sent ${qtyStr} ${symbol}`;
  if (op === "receive") return `Received ${qtyStr} ${symbol}`;
  if (op === "trade") return `Swapped ${qtyStr} ${symbol}`;
  return `${op || "Transaction"}`;
}
