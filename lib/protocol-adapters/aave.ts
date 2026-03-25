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

/**
 * Aave V3 adapter for Base.
 * Reads aToken balances to detect deposits.
 * A non-zero aToken balance = active lending position.
 */
export const aaveAdapter: ProtocolAdapter = {
  protocol: "Aave V3",

  async getPositions(address: `0x${string}`): Promise<Position[]> {
    const client = getClient();
    const positions: Position[] = [];

    // Read all aToken balances in parallel
    const entries = Object.entries(AAVE_ATOKENS);
    const balanceResults = await Promise.allSettled(
      entries.map(([, token]) =>
        client.readContract({
          address: token.aToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        })
      )
    );

    for (let i = 0; i < entries.length; i++) {
      const [symbol, token] = entries[i];
      const result = balanceResults[i];

      if (result.status !== "fulfilled") continue;
      const rawBalance = result.value as bigint;
      if (rawBalance === 0n) continue;

      const balance = formatUnits(rawBalance, token.decimals);
      const balanceNum = parseFloat(balance);

      // Rough USD estimate — stablecoins = 1:1, ETH variants use a placeholder
      // A proper price feed would be better but this works for MVP
      let usdValue = balanceNum;
      if (symbol === "WETH" || symbol === "cbETH") {
        // We don't have a price feed here, so estimate conservatively
        // The portfolio page can fetch real prices separately
        usdValue = balanceNum * 3000; // rough ETH price placeholder
      }

      positions.push({
        protocol: "Aave V3",
        pool: `a${symbol} (lending)`,
        tokens: [symbol],
        currentValue: usdValue,
        apy: null, // filled in by the hook from DeFiLlama data
        chain: "Base",
        balance,
        tokenAddress: token.aToken,
      });
    }

    return positions;
  },
};
