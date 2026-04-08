"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { CLAUDIA_CONTRACT, ERC20_ABI } from "@/lib/contracts";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";
import { formatUnits } from "viem";
import { base } from "wagmi/chains";

interface TokenGateProps {
  children: React.ReactNode;
  minBalance?: number;
  featureName?: string;
}

/**
 * Cache the last known balance in sessionStorage so we don't re-gate
 * on every navigation while wagmi is reconnecting.
 */
function getCachedBalance(): number | null {
  try {
    const raw = sessionStorage.getItem("claudia_balance_cache");
    if (!raw) return null;
    const { balance, ts } = JSON.parse(raw);
    // Valid for 60 seconds
    if (Date.now() - ts > 60_000) return null;
    return balance;
  } catch { return null; }
}

function setCachedBalance(balance: number): void {
  try {
    sessionStorage.setItem("claudia_balance_cache", JSON.stringify({ balance, ts: Date.now() }));
  } catch {}
}

export default function TokenGate({
  children,
  minBalance = GATE_THRESHOLDS.dashboard,
  featureName = "Claudia AI",
}: TokenGateProps) {
  const { address, isConnected } = useAccount();
  const [waited, setWaited] = useState(false);

  // Give wagmi up to 3s to reconnect on page load / navigation
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 3000);
    // If already connected, don't wait
    if (isConnected && address) setWaited(true);
    return () => clearTimeout(timer);
  }, [isConnected, address]);

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      {
        address: CLAUDIA_CONTRACT,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: base.id,
      },
      {
        address: CLAUDIA_CONTRACT,
        abi: ERC20_ABI,
        functionName: "decimals",
        chainId: base.id,
      },
    ],
    query: {
      enabled: isConnected && !!address,
      staleTime: 30_000,
      gcTime: 60_000,
      refetchInterval: 60_000,
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Check for cached balance from previous navigation
  const cachedBalance = getCachedBalance();

  // If we have a cached balance that passes the gate, skip the loading screen entirely
  if (cachedBalance !== null && cachedBalance >= minBalance && (!waited || isLoading)) {
    return <>{children}</>;
  }

  // Still connecting — show brief spinner
  if (!waited || (!isConnected && !cachedBalance)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Loading balance from RPC — show spinner only if no cached balance
  if (isLoading || (!data && address && isConnected)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // RPC failed — show retry
  const balanceCall = data?.[0];
  const decimalsCall = data?.[1];
  const rpcFailed = isError || balanceCall?.status === "failure" || decimalsCall?.status === "failure";

  if (rpcFailed) {
    // If we have a cached balance that passes, let through anyway
    if (cachedBalance !== null && cachedBalance >= minBalance) {
      return <>{children}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5">
          <h2 className="font-heading text-2xl font-bold text-white mb-3">
            Can&apos;t read your balance
          </h2>
          <p className="text-zinc-400 mb-4 text-sm">
            The Base RPC didn&apos;t respond. This usually fixes itself in a few seconds.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold
                       px-6 py-3 rounded-xl transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const rawBalance = balanceCall?.result as bigint | undefined;
  const decimals = (decimalsCall?.result as number | undefined) ?? 18;
  const balance = rawBalance ?? 0n;
  const humanBalance = Number(formatUnits(balance, decimals));
  const hasAccess = humanBalance >= minBalance;

  // Cache the balance for future navigation
  if (humanBalance > 0) {
    setCachedBalance(humanBalance);
  }

  if (!hasAccess) {
    const needed = Math.max(0, Math.ceil(minBalance - humanBalance));

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-heading text-xl font-bold text-white mb-4">
            You need{" "}
            <span className="text-accent">{minBalance.toLocaleString()} $CLAUDIA</span>
            {" "}to access {featureName}
          </h2>
          <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Required</span>
              <span className="text-white font-bold">{minBalance.toLocaleString()} $CLAUDIA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Your balance</span>
              <span className="text-white font-bold">{Math.floor(humanBalance).toLocaleString()} $CLAUDIA</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
              <span className="text-zinc-500">You need</span>
              <span className="text-accent font-bold">{needed.toLocaleString()} more</span>
            </div>
          </div>
          <a
            href={`https://aerodrome.finance/swap?from=0x4200000000000000000000000000000000000006&to=${CLAUDIA_CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent hover:bg-[#27c00e] text-white font-heading font-bold
                       px-6 py-3 rounded-xl transition-all duration-200"
          >
            Buy $CLAUDIA on Aerodrome
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
