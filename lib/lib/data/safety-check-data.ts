/**
 * Contract Safety Check — scans a single contract for honeypots, hidden mints,
 * dangerous ownership, LP locks, and trading manipulation.
 * Uses GoPlus + DexScreener + Basescan in parallel.
 */

export interface GoPlusData {
  is_open_source: boolean;
  is_proxy: boolean;
  owner_address: string | null;
  can_take_back_ownership: boolean;
  owner_change_balance: boolean;
  is_honeypot: boolean;
  buy_tax: number;
  sell_tax: number;
  is_blacklisted: boolean;
  is_whitelisted: boolean;
  trading_cooldown: boolean;
  transfer_pausable: boolean;
  is_mintable: boolean;
  hidden_owner: boolean;
  holder_count: number;
  top10_holder_percent: number;
  lp_holder_count: number;
  lp_locked: boolean;
  lp_lock_end: string | null;
  available: boolean;
}

export interface DexData {
  tokenName: string;
  tokenSymbol: string;
  priceUsd: string;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  volumeH1: number;
  priceChange24h: number;
  priceChangeH1: number;
  buys24h: number;
  sells24h: number;
  pairCreatedAt: number;
  chainId: string;
  dexId: string;
  ageHours: number;
  sellPressure: boolean;
  volumeSpike: boolean;
  lowLiquidity: boolean;
  available: boolean;
}

export interface BasescanData {
  contractName: string | null;
  symbol: string | null;
  totalSupply: string | null;
  website: string | null;
  available: boolean;
}

export interface SafetyCheckData {
  contractAddress: string;
  chain: string;
  goplus: GoPlusData;
  dex: DexData;
  basescan: BasescanData;
  error?: string;
}

const GOPLUS_DEFAULTS: GoPlusData = {
  is_open_source: false, is_proxy: false, owner_address: null,
  can_take_back_ownership: false, owner_change_balance: false,
  is_honeypot: false, buy_tax: 0, sell_tax: 0, is_blacklisted: false,
  is_whitelisted: false, trading_cooldown: false, transfer_pausable: false,
  is_mintable: false, hidden_owner: false, holder_count: 0,
  top10_holder_percent: 0, lp_holder_count: 0, lp_locked: false,
  lp_lock_end: null, available: false,
};

const DEX_DEFAULTS: DexData = {
  tokenName: "Unknown", tokenSymbol: "???", priceUsd: "0", marketCap: 0,
  liquidity: 0, volume24h: 0, volumeH1: 0, priceChange24h: 0,
  priceChangeH1: 0, buys24h: 0, sells24h: 0, pairCreatedAt: 0,
  chainId: "", dexId: "", ageHours: 0, sellPressure: false,
  volumeSpike: false, lowLiquidity: true, available: false,
};

async function fetchGoPlus(address: string): Promise<{ data: GoPlusData; chain: string }> {
  for (const chainId of ["8453", "1"]) {
    try {
      const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const json = await res.json() as any;
      const info = json.result?.[address.toLowerCase()];
      if (!info) continue;

      // Parse LP lock status
      let lpLocked = false;
      let lpLockEnd: string | null = null;
      const lpHolders = info.lp_holders || [];
      for (const lp of lpHolders) {
        if (lp.is_locked === 1) {
          lpLocked = true;
          if (lp.locked_detail?.length) {
            const endTimes = lp.locked_detail.map((d: any) => d.end_time).filter(Boolean);
            if (endTimes.length) lpLockEnd = new Date(Math.max(...endTimes.map(Number)) * 1000).toISOString().split("T")[0];
          }
          break;
        }
      }

      return {
        chain: chainId === "8453" ? "base" : "ethereum",
        data: {
          is_open_source: info.is_open_source === "1",
          is_proxy: info.is_proxy === "1",
          owner_address: info.owner_address || null,
          can_take_back_ownership: info.can_take_back_ownership === "1",
          owner_change_balance: info.owner_change_balance === "1",
          is_honeypot: info.is_honeypot === "1",
          buy_tax: parseFloat(info.buy_tax || "0") * 100,
          sell_tax: parseFloat(info.sell_tax || "0") * 100,
          is_blacklisted: info.is_blacklisted === "1",
          is_whitelisted: info.is_whitelisted === "1",
          trading_cooldown: info.trading_cooldown === "1",
          transfer_pausable: info.transfer_pausable === "1",
          is_mintable: info.is_mintable === "1",
          hidden_owner: info.hidden_owner === "1",
          holder_count: parseInt(info.holder_count || "0"),
          top10_holder_percent: parseFloat(info.top_10_holder_rate || "0"),
          lp_holder_count: parseInt(info.lp_holder_count || "0"),
          lp_locked: lpLocked,
          lp_lock_end: lpLockEnd,
          available: true,
        },
      };
    } catch {
      continue;
    }
  }
  return { data: GOPLUS_DEFAULTS, chain: "unknown" };
}

async function fetchDexScreener(address: string): Promise<DexData> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return DEX_DEFAULTS;
    const json = await res.json() as any;
    const pairs = json.pairs || [];
    if (pairs.length === 0) return DEX_DEFAULTS;

    // Pick highest liquidity pair
    const pair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const now = Date.now();
    const ageHours = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 3600000 : 0;
    const buys1h = pair.txns?.h1?.buys || 0;
    const sells1h = pair.txns?.h1?.sells || 0;
    const volH1 = pair.volume?.h1 || 0;
    const vol24h = pair.volume?.h24 || 0;
    const liq = pair.liquidity?.usd || 0;

    return {
      tokenName: pair.baseToken?.name || "Unknown",
      tokenSymbol: pair.baseToken?.symbol || "???",
      priceUsd: pair.priceUsd || "0",
      marketCap: pair.marketCap || pair.fdv || 0,
      liquidity: liq,
      volume24h: vol24h,
      volumeH1: volH1,
      priceChange24h: pair.priceChange?.h24 || 0,
      priceChangeH1: pair.priceChange?.h1 || 0,
      buys24h: pair.txns?.h24?.buys || 0,
      sells24h: pair.txns?.h24?.sells || 0,
      pairCreatedAt: pair.pairCreatedAt || 0,
      chainId: pair.chainId || "",
      dexId: pair.dexId || "",
      ageHours,
      sellPressure: sells1h > buys1h * 2 && sells1h > 5,
      volumeSpike: vol24h > 0 && volH1 > vol24h / 4,
      lowLiquidity: liq < 10000,
      available: true,
    };
  } catch {
    return DEX_DEFAULTS;
  }
}

async function fetchBasescan(address: string): Promise<BasescanData> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  if (!apiKey) return { contractName: null, symbol: null, totalSupply: null, website: null, available: false };

  try {
    const url = `https://api.basescan.org/api?module=token&action=tokeninfo&contractaddress=${address}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { contractName: null, symbol: null, totalSupply: null, website: null, available: false };
    const json = await res.json() as any;
    const info = json.result?.[0] || json.result;
    if (!info || typeof info !== "object") return { contractName: null, symbol: null, totalSupply: null, website: null, available: false };

    return {
      contractName: info.tokenName || info.contractName || null,
      symbol: info.symbol || null,
      totalSupply: info.totalSupply || null,
      website: info.website || null,
      available: true,
    };
  } catch {
    return { contractName: null, symbol: null, totalSupply: null, website: null, available: false };
  }
}

/**
 * Fetch all safety check data in parallel.
 */
export async function fetchSafetyCheckData(address: string): Promise<SafetyCheckData> {
  const [goplusResult, dex, basescan] = await Promise.all([
    fetchGoPlus(address),
    fetchDexScreener(address),
    fetchBasescan(address),
  ]);

  const chain = goplusResult.chain !== "unknown"
    ? goplusResult.chain
    : dex.chainId === "base" ? "base" : dex.chainId === "ethereum" ? "ethereum" : "unknown";

  if (!goplusResult.data.available && !dex.available) {
    return {
      contractAddress: address,
      chain,
      goplus: goplusResult.data,
      dex,
      basescan,
      error: "Contract not found on GoPlus or DexScreener. Too new, unsupported chain, or invalid address.",
    };
  }

  return {
    contractAddress: address,
    chain,
    goplus: goplusResult.data,
    dex,
    basescan,
  };
}

/**
 * Deterministic safety score: same input → same score.
 * Starting at 7, apply deductions and additions.
 */
export function calculateSafetyScore(data: SafetyCheckData): {
  score: number;
  verdict: "SAFE" | "CAUTION" | "RISKY" | "AVOID" | "RUN";
  flags: { type: "red" | "green"; label: string; detail: string }[];
} {
  const { goplus: g, dex: d } = data;
  const flags: { type: "red" | "green"; label: string; detail: string }[] = [];

  // Instant zero: honeypot
  if (g.is_honeypot) {
    flags.push({ type: "red", label: "HONEYPOT", detail: "Contract prevents selling. This is a trap." });
    return { score: 0, verdict: "RUN", flags };
  }

  let score = 7;

  // Major red flags (-2 each, max -6 from these)
  let majorDeductions = 0;
  if (!g.is_open_source && g.available) {
    flags.push({ type: "red", label: "Closed source", detail: "Contract code not verified — impossible to audit" });
    majorDeductions += 2;
  }
  if (g.is_mintable) {
    flags.push({ type: "red", label: "Mintable", detail: "Owner can mint infinite tokens, diluting all holders" });
    majorDeductions += 2;
  }
  if (g.sell_tax > 10) {
    flags.push({ type: "red", label: `High sell tax (${g.sell_tax.toFixed(1)}%)`, detail: "Selling costs more than 10% — potential exit trap" });
    majorDeductions += 2;
  }
  if (g.buy_tax > 10) {
    flags.push({ type: "red", label: `High buy tax (${g.buy_tax.toFixed(1)}%)`, detail: "Buying costs more than 10% — unusual and exploitative" });
    majorDeductions += 2;
  }
  if (g.hidden_owner) {
    flags.push({ type: "red", label: "Hidden owner", detail: "Ownership is obfuscated — dev is hiding control" });
    majorDeductions += 2;
  }
  if (g.can_take_back_ownership) {
    flags.push({ type: "red", label: "Ownership reclaimable", detail: "Owner renounced but can reclaim — fake renounce" });
    majorDeductions += 2;
  }
  if (g.transfer_pausable) {
    flags.push({ type: "red", label: "Transfers pausable", detail: "Dev can freeze all transfers at any time" });
    majorDeductions += 2;
  }
  score -= Math.min(majorDeductions, 6);

  // Moderate red flags (-1 each)
  if (g.is_proxy) {
    flags.push({ type: "red", label: "Proxy contract", detail: "Upgradeable — contract logic can be changed after deploy" });
    score -= 1;
  }
  if (g.is_blacklisted) {
    flags.push({ type: "red", label: "Blacklist function", detail: "Contract can block specific wallets from trading" });
    score -= 1;
  }
  if (g.owner_change_balance) {
    flags.push({ type: "red", label: "Balance manipulation", detail: "Owner can modify holder balances directly" });
    score -= 1;
  }
  if (g.top10_holder_percent > 0.80) {
    flags.push({ type: "red", label: `Top 10 hold ${(g.top10_holder_percent * 100).toFixed(0)}%`, detail: "Extreme supply concentration — dump risk" });
    score -= 1;
  }
  if (g.trading_cooldown) {
    flags.push({ type: "red", label: "Trading cooldown", detail: "Enforced delay between trades — restricts normal activity" });
    score -= 1;
  }
  if (d.ageHours < 24 && d.volumeSpike && d.available) {
    flags.push({ type: "red", label: "New + volume spike", detail: `Only ${d.ageHours.toFixed(0)}h old with unusual volume — possible pump` });
    score -= 1;
  }
  if (!g.lp_locked && g.available) {
    flags.push({ type: "red", label: "LP not locked", detail: "Liquidity can be pulled at any time — rug risk" });
    score -= 1;
  }
  if (d.lowLiquidity && d.available) {
    flags.push({ type: "red", label: `Low liquidity ($${d.liquidity.toLocaleString()})`, detail: "Easy to manipulate price with small trades" });
    score -= 1;
  }
  if (d.sellPressure && d.available) {
    flags.push({ type: "red", label: "Heavy sell pressure", detail: "Sells outpacing buys 2:1 in the last hour" });
    score -= 1;
  }

  // Positive signals (+1 each, max +3)
  let positives = 0;
  if (g.is_open_source && g.available) {
    flags.push({ type: "green", label: "Open source", detail: "Contract code is verified and auditable" });
    positives += 1;
  }
  if (g.lp_locked && g.lp_lock_end) {
    const lockEnd = new Date(g.lp_lock_end).getTime();
    const daysLocked = (lockEnd - Date.now()) / (86400 * 1000);
    if (daysLocked > 180) {
      flags.push({ type: "green", label: `LP locked until ${g.lp_lock_end}`, detail: `Liquidity locked for ${Math.floor(daysLocked)} more days` });
      positives += 1;
    }
  }
  if (g.holder_count > 500) {
    flags.push({ type: "green", label: `${g.holder_count.toLocaleString()} holders`, detail: "Meaningful holder distribution" });
    positives += 1;
  }
  if (g.buy_tax === 0 && g.sell_tax === 0 && g.available) {
    flags.push({ type: "green", label: "Zero tax", detail: "No buy or sell tax — fair trading" });
    positives += 1;
  }
  const ownerRenounced = !g.owner_address || g.owner_address === "0x0000000000000000000000000000000000000000" || g.owner_address === "0x000000000000000000000000000000000000dead";
  if (ownerRenounced && !g.can_take_back_ownership && g.available) {
    flags.push({ type: "green", label: "Ownership renounced", detail: "No single entity controls the contract" });
    positives += 1;
  }
  score += Math.min(positives, 3);

  // Clamp
  score = Math.max(0, Math.min(10, score));

  const verdict: "SAFE" | "CAUTION" | "RISKY" | "AVOID" | "RUN" =
    score >= 8 ? "SAFE" :
    score >= 6 ? "CAUTION" :
    score >= 4 ? "RISKY" :
    score >= 2 ? "AVOID" : "RUN";

  return { score, verdict, flags };
}
