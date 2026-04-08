import { getDB } from "@/lib/marketplace/db";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function fetchFirstTxTimestamp(
  address: string,
  baseUrl: string,
  apiKey: string
): Promise<number | null> {
  try {
    const url = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as any;
    if (data.status !== "1" || !data.result?.length) return null;
    return parseInt(data.result[0].timeStamp);
  } catch {
    return null;
  }
}

export async function getWalletAgeInDays(address: string): Promise<number> {
  const ethKey = process.env.ETHERSCAN_API_KEY || "";
  if (!ethKey) return 0;

  // Check Base first
  const baseTx = await fetchFirstTxTimestamp(
    address,
    "https://api.basescan.org/api",
    ethKey
  );

  // Check Ethereum mainnet
  const ethTx = await fetchFirstTxTimestamp(
    address,
    "https://api.etherscan.io/api",
    ethKey
  );

  // Use the oldest transaction across both chains
  const timestamps = [baseTx, ethTx].filter((t): t is number => t !== null);
  if (timestamps.length === 0) return 0;

  const oldest = Math.min(...timestamps);
  return Math.floor((Date.now() / 1000 - oldest) / 86400);
}

export async function isWalletOldEnough(
  address: string,
  minDays = 30
): Promise<boolean> {
  const db = getDB();
  const lower = address.toLowerCase();

  // Check D1 cache first
  const cached = await db
    .prepare(
      "SELECT wallet_age_days, checked_at FROM wallet_age_cache WHERE address = ?"
    )
    .bind(lower)
    .first<{ wallet_age_days: number; checked_at: number }>();

  if (cached && Date.now() - cached.checked_at < CACHE_TTL) {
    return cached.wallet_age_days >= minDays;
  }

  // Fetch and cache
  const age = await getWalletAgeInDays(lower);
  await db
    .prepare(
      "INSERT OR REPLACE INTO wallet_age_cache (address, wallet_age_days, checked_at) VALUES (?, ?, ?)"
    )
    .bind(lower, age, Date.now())
    .run();

  return age >= minDays;
}
