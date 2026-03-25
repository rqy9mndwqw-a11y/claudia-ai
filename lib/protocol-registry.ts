export interface ProtocolMeta {
  launched: number; // year
  audited: boolean;
  auditor?: string;
  category: "lending" | "dex" | "yield" | "liquid-staking" | "cdp" | "bridge";
}

/**
 * Hardcoded metadata for known DeFi protocols.
 * Keys match DeFiLlama `project` field (lowercased, hyphenated).
 */
export const PROTOCOL_REGISTRY: Record<string, ProtocolMeta> = {
  // Lending
  "aave-v3": { launched: 2023, audited: true, auditor: "Trail of Bits, Certora", category: "lending" },
  "aave-v2": { launched: 2020, audited: true, auditor: "Trail of Bits, OpenZeppelin", category: "lending" },
  "compound-v3": { launched: 2022, audited: true, auditor: "OpenZeppelin, ChainSecurity", category: "lending" },
  "morpho": { launched: 2022, audited: true, auditor: "Spearbit", category: "lending" },
  "moonwell": { launched: 2023, audited: true, auditor: "Halborn", category: "lending" },

  // DEXes
  "aerodrome-v1": { launched: 2023, audited: true, auditor: "Code4rena", category: "dex" },
  "aerodrome-v2": { launched: 2024, audited: true, auditor: "Code4rena", category: "dex" },
  "uniswap-v3": { launched: 2021, audited: true, auditor: "Trail of Bits, ABDK", category: "dex" },
  "curve-dex": { launched: 2020, audited: true, auditor: "Trail of Bits, Quantstamp", category: "dex" },
  "balancer-v2": { launched: 2021, audited: true, auditor: "Trail of Bits, OpenZeppelin", category: "dex" },

  // Yield
  "extra-finance": { launched: 2023, audited: true, auditor: "PeckShield", category: "yield" },
  "beefy": { launched: 2020, audited: true, auditor: "Certik", category: "yield" },
  "yearn-finance": { launched: 2020, audited: true, auditor: "Trail of Bits", category: "yield" },
  "convex-finance": { launched: 2021, audited: true, auditor: "MixBytes", category: "yield" },
  "pendle": { launched: 2023, audited: true, auditor: "Ackee, Dingbats", category: "yield" },

  // Liquid staking
  "lido": { launched: 2020, audited: true, auditor: "Quantstamp, MixBytes", category: "liquid-staking" },
  "rocket-pool": { launched: 2021, audited: true, auditor: "Sigma Prime, Consensys", category: "liquid-staking" },
  "coinbase-wrapped-staked-eth": { launched: 2022, audited: true, auditor: "OpenZeppelin", category: "liquid-staking" },
};

/**
 * Look up protocol metadata. Normalizes the project name to match registry keys.
 */
export function getProtocolMeta(project: string): ProtocolMeta | null {
  const key = project.toLowerCase().replace(/\s+/g, "-");
  return PROTOCOL_REGISTRY[key] ?? null;
}

/**
 * Get the age of a protocol in years (from launch year to now).
 */
export function getProtocolAge(project: string): number | null {
  const meta = getProtocolMeta(project);
  if (!meta) return null;
  return new Date().getFullYear() - meta.launched;
}
