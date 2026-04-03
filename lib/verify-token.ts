import { createPublicClient, http, formatUnits, fallback } from "viem";
import { base } from "viem/chains";
import { CLAUDIA_CONTRACT, ERC20_ABI, MIN_CLAUDIA_BALANCE } from "./contracts";

const CACHE_TTL_MS = 60_000; // 60 seconds

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
  return 500 * Math.pow(3, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check D1 balance cache. Returns cached balance if fresh, null if expired/missing.
 */
async function getCachedBalance(address: string): Promise<number | null> {
  try {
    const { getDB } = await import("./marketplace/db");
    const db = getDB();
    const row = await db.prepare(
      "SELECT balance, checked_at FROM balance_cache WHERE address = ?"
    ).bind(address.toLowerCase()).first<{ balance: string; checked_at: number }>();

    if (!row) return null;
    if (Date.now() - row.checked_at > CACHE_TTL_MS) return null;

    return Number(row.balance);
  } catch {
    return null; // Cache unavailable — fall through to RPC
  }
}

/**
 * Write balance to D1 cache.
 */
async function setCachedBalance(address: string, balance: number): Promise<void> {
  try {
    const { getDB } = await import("./marketplace/db");
    const db = getDB();
    await db.prepare(
      "INSERT OR REPLACE INTO balance_cache (address, balance, checked_at) VALUES (?, ?, ?)"
    ).bind(address.toLowerCase(), String(balance), Date.now()).run();
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Server-side verification of $CLAUDIA token balance.
 * Checks D1 cache first (60s TTL). Falls back to RPC with retry on miss.
 */
export async function verifyTokenBalance(
  address: string,
  minRequired?: number
): Promise<{ authorized: boolean; balance: number }> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { authorized: false, balance: 0 };
  }

  const min = minRequired ?? Number(MIN_CLAUDIA_BALANCE);

  // Check D1 cache first (~30ms vs up to 19s for RPC)
  const cached = await getCachedBalance(address);
  if (cached !== null) {
    return { authorized: cached >= min, balance: cached };
  }

  // Cache miss — hit RPC with retry
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

      // Cache the result for next time
      await setCachedBalance(address, balance);

      return { authorized: balance >= min, balance };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw new Error(
    `All ${MAX_ATTEMPTS} RPC attempts failed: ${lastError?.message?.slice(0, 100) || "unknown error"}`
  );
}
