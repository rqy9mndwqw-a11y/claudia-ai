import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { AAVE_ATOKENS, ERC20_ABI } from "../contracts";
import type { Position, ProtocolAdapter } from "./types";

const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
];

function getClient() {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URLS[0]),
  });
}

/** Tokens that need a price feed (not stablecoins) */
const NEEDS_PRICE = new Set(["WETH", "cbETH"]);

/** Fetch ETH price from DeFiLlama (free, no API key). Falls back to CoinGecko. */
async function fetchEthPrice(): Promise<number> {
  try {
    const res = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const price = data?.coins?.["coingecko:ethereum"]?.price;
      if (typeof price === "number" && price > 0) return price;
    }
  } catch {}

  // Fallback: CoinGecko direct
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const price = data?.ethereum?.usd;
      if (typeof price === "number" && price > 0) return price;
    }
  } catch {}

  // Last resort — stale but better than nothing
  return 3000;
}

/**
 * Aave V3 adapter for Base.
 * Reads aToken balances to detect deposits.
 * Fetches live ETH price for non-stablecoin positions.
 */
export const aaveAdapter: ProtocolAdapter = {
  protocol: "Aave V3",

  async getPositions(address: `0x${string}`): Promise<Position[]> {
    const client = getClient();
    const positions: Position[] = [];

    // Fetch balances and ETH price in parallel
    const entries = Object.entries(AAVE_ATOKENS);
    const [balanceResults, ethPrice] = await Promise.all([
      Promise.allSettled(
        entries.map(([, token]) =>
          client.readContract({
            address: token.aToken,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          })
        )
      ),
      fetchEthPrice(),
    ]);

    for (let i = 0; i < entries.length; i++) {
      const [symbol, token] = entries[i];
      const result = balanceResults[i];

      if (result.status !== "fulfilled") continue;
      const rawBalance = result.value as bigint;
      if (rawBalance === 0n) continue;

      const balance = formatUnits(rawBalance, token.decimals);
      const balanceNum = parseFloat(balance);

      let usdValue = balanceNum;
      if (NEEDS_PRICE.has(symbol)) {
        usdValue = balanceNum * ethPrice;
      }

      positions.push({
        protocol: "Aave V3",
        pool: `a${symbol} (lending)`,
        tokens: [symbol],
        currentValue: usdValue,
        apy: null,
        chain: "Base",
        balance,
        tokenAddress: token.aToken,
      });
    }

    return positions;
  },
};
