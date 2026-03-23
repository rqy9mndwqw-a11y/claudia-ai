import { createPublicClient, http, formatUnits, fallback } from "viem";
import { base } from "viem/chains";
import { CLAUDIA_CONTRACT, ERC20_ABI, MIN_CLAUDIA_BALANCE } from "./contracts";

/**
 * Create a fresh public client per request.
 * On CF Workers, a module-level singleton can cache transport-level
 * failures across requests within the same isolate.
 */
function createClient() {
  return createPublicClient({
    chain: base,
    transport: fallback([
      http("https://mainnet.base.org"),
      http("https://base.meowrpc.com"),
      http("https://1rpc.io/base"),
      http("https://base.drpc.org"),
    ]),
  });
}

const MAX_ATTEMPTS = 3;

function backoffMs(attempt: number): number {
  // 500ms, 1500ms, 4500ms
  return 500 * Math.pow(3, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Server-side verification of $CLAUDIA token balance.
 * Creates a fresh viem client per attempt to avoid stale transport state.
 * 3 attempts with exponential backoff.
 */
export async function verifyTokenBalance(
  address: string,
  minRequired?: number
): Promise<{ authorized: boolean; balance: number }> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { authorized: false, balance: 0 };
  }

  const min = minRequired ?? Number(MIN_CLAUDIA_BALANCE);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs(attempt - 1));
    }

    try {
      const client = createClient();

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
      return { authorized: balance >= min, balance };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw new Error(
    `All ${MAX_ATTEMPTS} RPC attempts failed: ${lastError?.message?.slice(0, 100) || "unknown error"}`
  );
}
