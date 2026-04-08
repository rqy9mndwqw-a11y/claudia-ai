/**
 * Dev Wallet Reputation Data — analyzes a deployer wallet's full history.
 * Uses Basescan/Etherscan (contract deploys), DexScreener (market data),
 * and GoPlus (security checks) in parallel.
 */

export interface ProjectSummary {
  name: string;
  symbol: string;
  contractAddress: string;
  chain: string;
  status: "active" | "dead" | "rugged" | "unknown";
  currentMcap: number;
  liquidity: number;
  ageInDays: number;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  holderCount: number;
  topHolderConcentration: number;
  volume24h: number;
}

export interface DevWalletData {
  walletAddress: string;
  totalDeployed: number;
  activeProjects: number;
  deadProjects: number;
  ruggedProjects: number;
  unknownProjects: number;
  projects: ProjectSummary[];
  firstDeployDate: string;
  avgProjectLifespanDays: number;
  redFlags: string[];
  greenFlags: string[];
  error?: string;
}

/**
 * Extract an Ethereum address from free-form text.
 */
export function extractAddressFromQuery(query: string): string | null {
  const match = query.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : null;
}

/**
 * Fetch all contract creation transactions from a wallet.
 * Uses Basescan (Base) and Etherscan (Ethereum) in parallel.
 */
async function fetchDeployedContracts(
  address: string,
): Promise<{ contractAddress: string; chain: string; timestamp: number }[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  // TODO: If no API key, these endpoints still work but with lower rate limits

  const endpoints = [
    { chain: "base", url: `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}` },
    { chain: "ethereum", url: `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}` },
  ];

  const results: { contractAddress: string; chain: string; timestamp: number }[] = [];

  const responses = await Promise.allSettled(
    endpoints.map(async ({ chain, url }) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json() as any;
      if (data.status !== "1" || !Array.isArray(data.result)) return [];

      // Contract creations: transactions where `to` is empty and contractAddress is set
      return data.result
        .filter((tx: any) => tx.to === "" && tx.contractAddress)
        .map((tx: any) => ({
          contractAddress: tx.contractAddress as string,
          chain,
          timestamp: parseInt(tx.timeStamp) * 1000,
        }));
    }),
  );

  for (const r of responses) {
    if (r.status === "fulfilled") results.push(...r.value);
  }

  return results;
}

/**
 * Fetch DexScreener data for a list of contract addresses.
 */
async function fetchDexScreenerData(
  contracts: { contractAddress: string; chain: string }[],
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  if (contracts.length === 0) return results;

  // DexScreener: batch up to 30 addresses per request
  const batches: string[][] = [];
  for (let i = 0; i < contracts.length; i += 30) {
    batches.push(contracts.slice(i, i + 30).map((c) => c.contractAddress));
  }

  for (const batch of batches) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json() as any;
      const pairs = data.pairs || [];

      // Group by base token address, take the highest liquidity pair
      for (const pair of pairs) {
        const addr = pair.baseToken?.address?.toLowerCase();
        if (!addr) continue;
        const existing = results.get(addr);
        if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
          results.set(addr, pair);
        }
      }
    } catch {
      // Continue without this batch
    }
  }

  return results;
}

/**
 * Fetch GoPlus security data for contract addresses.
 */
async function fetchGoPlusData(
  contracts: { contractAddress: string; chain: string }[],
): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  if (contracts.length === 0) return results;

  // Group by chain for GoPlus
  const byChain: Record<string, string[]> = {};
  for (const c of contracts) {
    const chainId = c.chain === "base" ? "8453" : "1";
    if (!byChain[chainId]) byChain[chainId] = [];
    byChain[chainId].push(c.contractAddress);
  }

  for (const [chainId, addrs] of Object.entries(byChain)) {
    // GoPlus supports up to ~20 addresses per request
    for (let i = 0; i < addrs.length; i += 20) {
      const batch = addrs.slice(i, i + 20);
      try {
        const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${batch.join(",")}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const tokens = data.result || {};

        for (const [addr, info] of Object.entries(tokens)) {
          results.set(addr.toLowerCase(), info);
        }
      } catch {
        // Continue without security data for this batch
      }
    }
  }

  return results;
}

/**
 * Main fetch function — orchestrates all three data sources.
 */
export async function fetchDevWalletData(address: string): Promise<DevWalletData> {
  const wallet = address.toLowerCase();

  // Step 1: Get all deployed contracts
  const deployedContracts = await fetchDeployedContracts(wallet);

  if (deployedContracts.length === 0) {
    return {
      walletAddress: wallet,
      totalDeployed: 0,
      activeProjects: 0,
      deadProjects: 0,
      ruggedProjects: 0,
      unknownProjects: 0,
      projects: [],
      firstDeployDate: "",
      avgProjectLifespanDays: 0,
      redFlags: [],
      greenFlags: [],
      error: "No token deployments found for this wallet. Either a fresh wallet or not a dev wallet.",
    };
  }

  // Step 2: Fetch DexScreener + GoPlus in parallel
  const [dexData, securityData] = await Promise.all([
    fetchDexScreenerData(deployedContracts),
    fetchGoPlusData(deployedContracts),
  ]);

  // Step 3: Build project summaries
  const now = Date.now();
  const projects: ProjectSummary[] = [];
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  for (const contract of deployedContracts) {
    const addr = contract.contractAddress.toLowerCase();
    const dex = dexData.get(addr);
    const sec = securityData.get(addr);

    const ageInDays = Math.floor((now - contract.timestamp) / (86400 * 1000));
    const volume24h = dex?.volume?.h24 || 0;
    const liquidity = dex?.liquidity?.usd || 0;
    const currentMcap = dex?.marketCap || dex?.fdv || 0;
    const isHoneypot = sec?.is_honeypot === "1";
    const buyTax = parseFloat(sec?.buy_tax || "0") * 100;
    const sellTax = parseFloat(sec?.sell_tax || "0") * 100;
    const holderCount = parseInt(sec?.holder_count || "0");
    const topHolderPct = parseFloat(sec?.top_10_holder_rate || "0") * 100;

    // Determine status
    let status: ProjectSummary["status"] = "unknown";
    if (isHoneypot || sellTax > 80) {
      status = "rugged";
    } else if (dex && liquidity < 100 && ageInDays > 7) {
      // Had a pair but liquidity basically gone
      status = "rugged";
    } else if (dex && volume24h > 0) {
      status = "active";
    } else if (dex && volume24h === 0 && ageInDays > 7) {
      status = "dead";
    }

    projects.push({
      name: dex?.baseToken?.name || sec?.token_name || "Unknown Token",
      symbol: dex?.baseToken?.symbol || sec?.token_symbol || "???",
      contractAddress: contract.contractAddress,
      chain: contract.chain,
      status,
      currentMcap,
      liquidity,
      ageInDays,
      isHoneypot,
      buyTax,
      sellTax,
      holderCount,
      topHolderConcentration: topHolderPct,
      volume24h,
    });
  }

  // Step 4: Compute stats
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const deadProjects = projects.filter((p) => p.status === "dead").length;
  const ruggedProjects = projects.filter((p) => p.status === "rugged").length;
  const unknownProjects = projects.filter((p) => p.status === "unknown").length;

  const timestamps = deployedContracts.map((c) => c.timestamp).sort((a, b) => a - b);
  const firstDeployDate = new Date(timestamps[0]).toISOString().split("T")[0];

  const ages = projects.filter((p) => p.ageInDays > 0).map((p) => p.ageInDays);
  const avgLifespan = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

  // Step 5: Red/green flags
  if (ruggedProjects > 0) redFlags.push(`${ruggedProjects} confirmed rug(s) or honeypot(s)`);
  if (projects.some((p) => p.sellTax > 20 && p.status !== "rugged")) redFlags.push("High sell tax (>20%) on active tokens");
  if (projects.some((p) => p.topHolderConcentration > 80)) redFlags.push("Top 10 holders control >80% supply on a project");
  if (deadProjects > activeProjects && deadProjects > 2) redFlags.push(`More dead projects (${deadProjects}) than active (${activeProjects}) — serial launcher pattern`);
  if (projects.length > 5 && avgLifespan < 14) redFlags.push(`${projects.length} tokens deployed with avg lifespan ${avgLifespan} days — pump and dump pattern`);
  if (projects.some((p) => p.isHoneypot)) redFlags.push("Deployed at least one honeypot contract");

  if (activeProjects > 0 && ruggedProjects === 0) greenFlags.push("No rugs or honeypots detected");
  if (projects.some((p) => p.ageInDays > 90 && p.status === "active")) greenFlags.push("Has project(s) active for 90+ days");
  if (projects.some((p) => p.holderCount > 1000)) greenFlags.push("Built project with 1,000+ holders");
  if (ages.length > 0 && avgLifespan > 60) greenFlags.push(`Average project lifespan ${avgLifespan} days — builds for longevity`);
  if (projects.every((p) => p.buyTax < 5 && p.sellTax < 5)) greenFlags.push("All tokens have <5% tax — fair tokenomics");
  const openSource = projects.filter((p) => {
    const sec = securityData.get(p.contractAddress.toLowerCase());
    return sec?.is_open_source === "1";
  });
  if (openSource.length > 0 && openSource.length === projects.length) greenFlags.push("All contracts are open source and verified");

  return {
    walletAddress: wallet,
    totalDeployed: projects.length,
    activeProjects,
    deadProjects,
    ruggedProjects,
    unknownProjects,
    projects,
    firstDeployDate,
    avgProjectLifespanDays: avgLifespan,
    redFlags,
    greenFlags,
  };
}
