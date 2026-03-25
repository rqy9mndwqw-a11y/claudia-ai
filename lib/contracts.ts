export const CLAUDIA_CONTRACT = (process.env.NEXT_PUBLIC_CLAUDIA_CONTRACT ||
  "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B") as `0x${string}`;

export const MIN_CLAUDIA_BALANCE = BigInt(
  process.env.NEXT_PUBLIC_MIN_CLAUDIA_BALANCE || "10000"
);

// Standard ERC-20 ABI — only the functions we need
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ── Aave V3 on Base ──

export const AAVE_POOL_ADDRESS = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as `0x${string}`;

/** aToken addresses on Base — maps underlying symbol → aToken address */
export const AAVE_ATOKENS: Record<string, { aToken: `0x${string}`; underlying: `0x${string}`; symbol: string; decimals: number }> = {
  USDC: {
    aToken: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB" as `0x${string}`,
    underlying: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
    symbol: "USDC",
    decimals: 6,
  },
  WETH: {
    aToken: "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7" as `0x${string}`,
    underlying: "0x4200000000000000000000000000000000000006" as `0x${string}`,
    symbol: "WETH",
    decimals: 18,
  },
  cbETH: {
    aToken: "0xcf3D55c10DB69f28fD1A75Bd73f3D8A2d9c595ad" as `0x${string}`,
    underlying: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as `0x${string}`,
    symbol: "cbETH",
    decimals: 18,
  },
  USDbC: {
    aToken: "0x0a1d576f3eFeF75b330424287a95A366e8281D54" as `0x${string}`,
    underlying: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as `0x${string}`,
    symbol: "USDbC",
    decimals: 6,
  },
};

export const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

// ── Aerodrome on Base ──

export const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as `0x${string}`;

/** Minimal Aerodrome gauge ABI for reading staked balances and rewards */
export const AERODROME_GAUGE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "earned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
