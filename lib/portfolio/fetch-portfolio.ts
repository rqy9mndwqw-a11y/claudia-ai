/**
 * Multi-chain portfolio fetcher via Ankr (free, no API key).
 * Never throws — always returns partial data on failure.
 */

const ANKR_URL = "https://rpc.ankr.com/multichain";
const CLAUDIA_CONTRACT = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

const SUPPORTED_CHAINS = ["base", "eth", "polygon", "arbitrum", "optimism", "avalanche", "bsc"];

export type TokenBalance = {
  chain: string;
  chainName: string;
  contractAddress: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUsd: number;
  price: number;
  priceChange24h: number;
  thumbnail?: string;
  isNative: boolean;
};

export type NFTItem = {
  chain: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  collection: string;
  imageUrl?: string;
};

export type DeFiPosition = {
  chain: string;
  protocol: string;
  type: "lp" | "staking" | "lending" | "farming" | "other";
  tokenA?: string;
  tokenB?: string;
  valueUsd: number;
  apr?: number;
};

export type Transaction = {
  hash: string;
  chain: string;
  timestamp: number;
  type: "send" | "receive" | "swap" | "contract";
  fromAddress: string;
  toAddress: string;
  valueUsd?: number;
  tokenSymbol?: string;
  description: string;
};

export type PortfolioData = {
  address: string;
  totalValueUsd: number;
  change24hUsd: number;
  change24hPct: number;
  tokens: TokenBalance[];
  nfts: NFTItem[];
  defi: DeFiPosition[];
  transactions: Transaction[];
  fetchedAt: number;
  chains: string[];
  hasClaudia: boolean;
  claudiaBalance?: number;
};

export async function fetchPortfolio(address: string): Promise<PortfolioData> {
  // Try Zerion first (richer data, multi-chain, DeFi positions, PnL)
  // Fall back to Ankr if Zerion key not configured or fails
  if (process.env.ZERION_API_KEY) {
    try {
      const { fetchZerionPortfolio } = await import("@/lib/data/zerion");
      const zerionResult = await fetchZerionPortfolio(address);
      if (zerionResult.tokens.length > 0 || zerionResult.totalValueUsd > 0) {
        return zerionResult;
      }
    } catch (err) {
      console.error("Zerion failed, falling back to Ankr:", (err as Error).message);
    }
  }

  // Ankr fallback
  const [tokens, nfts, transactions] = await Promise.allSettled([
    fetchTokenBalances(address),
    fetchNFTs(address),
    fetchTransactions(address),
  ]);

  const tokenList = tokens.status === "fulfilled" ? tokens.value : [];
  const nftList = nfts.status === "fulfilled" ? nfts.value : [];
  const txList = transactions.status === "fulfilled" ? transactions.value : [];

  const totalValueUsd = tokenList.reduce((sum, t) => sum + t.balanceUsd, 0);

  const claudiaToken = tokenList.find(
    (t) => t.contractAddress.toLowerCase() === CLAUDIA_CONTRACT.toLowerCase()
  );

  const change24hUsd = tokenList.reduce((sum, t) => {
    if (!t.priceChange24h) return sum;
    const prevValue = t.balanceUsd / (1 + t.priceChange24h / 100);
    return sum + (t.balanceUsd - prevValue);
  }, 0);

  const change24hPct = totalValueUsd > 0 ? (change24hUsd / totalValueUsd) * 100 : 0;
  const chains = [...new Set(tokenList.map((t) => t.chain))];

  return {
    address,
    totalValueUsd,
    change24hUsd,
    change24hPct,
    tokens: tokenList.sort((a, b) => b.balanceUsd - a.balanceUsd),
    nfts: nftList,
    defi: [],
    transactions: txList,
    fetchedAt: Date.now(),
    chains,
    hasClaudia: !!claudiaToken,
    claudiaBalance: claudiaToken ? parseFloat(claudiaToken.balance) : undefined,
  };
}

async function fetchTokenBalances(address: string): Promise<TokenBalance[]> {
  try {
    const res = await fetch(ANKR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ankr_getAccountBalance",
        params: {
          walletAddress: address,
          blockchain: SUPPORTED_CHAINS,
          onlyWhitelisted: false,
          pageSize: 50,
        },
        id: 1,
      }),
      cf: { cacheTtl: 60, cacheEverything: true },
    } as any);
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const assets = data?.result?.assets || [];

    return assets
      .filter((a: any) => parseFloat(a.balanceUsd || "0") > 0.01)
      .map(
        (a: any): TokenBalance => ({
          chain: a.blockchain,
          chainName: formatChainName(a.blockchain),
          contractAddress: a.contractAddress || "native",
          symbol: a.tokenSymbol || "???",
          name: a.tokenName || a.tokenSymbol || "Unknown",
          balance: a.balance || "0",
          balanceUsd: parseFloat(a.balanceUsd) || 0,
          price: parseFloat(a.tokenPrice) || 0,
          priceChange24h: 0,
          thumbnail: a.thumbnail || undefined,
          isNative: !a.contractAddress || a.contractAddress === "",
        })
      );
  } catch {
    return [];
  }
}

async function fetchNFTs(address: string): Promise<NFTItem[]> {
  try {
    const res = await fetch(ANKR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ankr_getNFTsByOwner",
        params: {
          walletAddress: address,
          blockchain: ["base", "eth", "polygon"],
          pageSize: 50,
        },
        id: 1,
      }),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as any);
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const nfts = data?.result?.assets || [];

    return nfts.map(
      (n: any): NFTItem => ({
        chain: n.blockchain || "eth",
        contractAddress: n.contractAddress || "",
        tokenId: n.tokenId || "0",
        name: n.name || `#${n.tokenId}`,
        collection: n.collectionName || "Unknown Collection",
        imageUrl: n.imageUrl || n.animationUrl || undefined,
      })
    );
  } catch {
    return [];
  }
}

async function fetchTransactions(address: string): Promise<Transaction[]> {
  try {
    const res = await fetch(ANKR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "ankr_getTransactionsByAddress",
        params: {
          address,
          blockchain: ["base", "eth"],
          pageSize: 20,
          descOrder: true,
        },
        id: 1,
      }),
      cf: { cacheTtl: 120, cacheEverything: true },
    } as any);
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const txs = data?.result?.transactions || [];

    return txs.map(
      (tx: any): Transaction => ({
        hash: tx.hash || "",
        chain: tx.blockchain || "base",
        timestamp: parseInt(tx.timestamp || "0") * 1000,
        type: classifyTransaction(tx, address),
        fromAddress: tx.from || "",
        toAddress: tx.to || "",
        valueUsd: tx.value ? parseFloat(tx.value) * (parseFloat(tx.nativeTokenPrice) || 0) : 0,
        tokenSymbol: tx.tokenSymbol || undefined,
        description: buildTxDescription(tx, address),
      })
    );
  } catch {
    return [];
  }
}

export function formatChainName(chain: string): string {
  const names: Record<string, string> = {
    base: "Base",
    eth: "Ethereum",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    avalanche: "Avalanche",
    bsc: "BNB Chain",
  };
  return names[chain] || chain;
}

function classifyTransaction(tx: any, address: string): Transaction["type"] {
  const from = (tx.from || "").toLowerCase();
  const to = (tx.to || "").toLowerCase();
  const addr = address.toLowerCase();
  if (from === addr && to !== addr) return "send";
  if (to === addr && from !== addr) return "receive";
  return "contract";
}

function buildTxDescription(tx: any, address: string): string {
  const from = (tx.from || "").toLowerCase();
  const addr = address.toLowerCase();
  const symbol = tx.tokenSymbol || "ETH";
  const value = tx.value ? parseFloat(tx.value).toFixed(4) : "";
  if (from === addr) return `Sent ${value} ${symbol}`;
  return `Received ${value} ${symbol}`;
}
