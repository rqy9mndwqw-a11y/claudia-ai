import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { CLAUDIA_CONTRACT, ERC20_ABI, MIN_CLAUDIA_BALANCE } from "./contracts";

const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

/**
 * Server-side verification of $CLAUDIA token balance.
 * Returns { authorized, balance } — calls Base RPC directly.
 */
export async function verifyTokenBalance(
  address: string
): Promise<{ authorized: boolean; balance: number }> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { authorized: false, balance: 0 };
  }

  const [rawBalance, decimals] = await Promise.all([
    client.readContract({
      address: CLAUDIA_CONTRACT,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    }),
    client.readContract({
      address: CLAUDIA_CONTRACT,
      abi: ERC20_ABI,
      functionName: "decimals",
    }),
  ]);

  const balance = Number(formatUnits(rawBalance as bigint, decimals as number));
  const authorized = balance >= Number(MIN_CLAUDIA_BALANCE);

  return { authorized, balance };
}
