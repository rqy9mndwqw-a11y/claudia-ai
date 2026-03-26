"use client";

import { useState, useEffect, useCallback } from "react";

const CLAUDIA_TOKEN = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const RPC_URL = "https://mainnet.base.org";

function encodeBalanceOf(addr: string): string {
  return "0x70a08231000000000000000000000000" + addr.replace("0x", "").toLowerCase();
}

/**
 * Fetches the total $CLAUDIA burned (balance of 0xdead).
 * Uses raw RPC call — no viem singleton, fresh per fetch.
 * Auto-refreshes every 30 seconds.
 */
export function useBurnedAmount(): { burned: number | null; isLoading: boolean } {
  const [burned, setBurned] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBurned = useCallback(async () => {
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: CLAUDIA_TOKEN, data: encodeBalanceOf(BURN_ADDRESS) }, "latest"],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json() as any;
      if (data.result && data.result !== "0x") {
        setBurned(Number(BigInt(data.result) / BigInt(10 ** 18)));
      }
    } catch {
      // Silent fail — don't break the UI for a cosmetic counter
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBurned();
    const interval = setInterval(fetchBurned, 30_000);
    return () => clearInterval(interval);
  }, [fetchBurned]);

  return { burned, isLoading };
}
