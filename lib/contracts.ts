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
