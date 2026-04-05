/**
 * Check $CLAUDIA token balance via Base RPC.
 * Uses raw eth_call — no viem dependency needed.
 * Tries multiple RPCs since some block CF Worker IPs.
 */

const CLAUDIA_TOKEN = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
const BASE_RPCS = [
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
  "https://base.drpc.org",
  "https://mainnet.base.org",
];

// balanceOf(address) selector = 0x70a08231
function encodeBalanceOf(address: string): string {
  const addr = address.toLowerCase().replace("0x", "").padStart(64, "0");
  return "0x70a08231" + addr;
}

export async function getClaudiaBalance(walletAddress: string): Promise<number> {
  for (const rpc of BASE_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            { to: CLAUDIA_TOKEN, data: encodeBalanceOf(walletAddress) },
            "latest",
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = (await res.json()) as any;
      if (!data.result || data.result === "0x" || data.error) continue;

      const rawBigInt = BigInt(data.result);
      const balance = Number(rawBigInt / (BigInt(10) ** BigInt(18)));
      console.log(JSON.stringify({ event: "balance_check", rpc, wallet: walletAddress.slice(0, 10), balance }));
      return balance;
    } catch (err) {
      console.error(`RPC ${rpc} failed:`, (err as Error).message);
      continue;
    }
  }

  console.error("All RPCs failed for balance check");
  return 0;
}
