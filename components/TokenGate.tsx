"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { CLAUDIA_CONTRACT, ERC20_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";
import { base } from "wagmi/chains";

interface TokenGateProps {
  children: React.ReactNode;
  minBalance?: number;
  featureName?: string;
}

export default function TokenGate({
  children,
  minBalance = 10_000,
  featureName = "Claudia AI",
}: TokenGateProps) {
  const { address, isConnected } = useAccount();
  const [waited, setWaited] = useState(false);

  // Give wagmi 1.5s to reconnect on page load / navigation
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

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
      // Cache results for 10s — prevents re-fetch storms while still
      // picking up balance changes reasonably fast
      staleTime: 10_000,
      // Keep gc'd data around for 30s so navigating back doesn't re-fetch
      gcTime: 30_000,
      // Poll every 30s for balance updates
      refetchInterval: 30_000,
      // Retry 3x with exponential backoff on failure
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Still connecting
  if (!waited || !isConnected) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Loading balance
  if (isLoading || (!data && address)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Check if the RPC calls actually succeeded
  const balanceCall = data?.[0];
  const decimalsCall = data?.[1];
  const rpcFailed = isError || balanceCall?.status === "failure" || decimalsCall?.status === "failure";

  if (rpcFailed) {
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
            className="bg-accent hover:bg-accent/80 text-white font-heading font-bold
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

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-heading text-2xl font-bold text-white mb-3">
            Hold Up
          </h2>
          <p className="text-zinc-400 mb-2">
            You need at least{" "}
            <span className="text-accent font-bold">
              {minBalance.toLocaleString()} $CLAUDIA
            </span>{" "}
            to access {featureName}.
          </p>
          <p className="text-zinc-500 text-sm mb-2">
            Your balance: {humanBalance.toLocaleString()} $CLAUDIA
          </p>
          <p className="text-zinc-600 text-xs mb-6">
            You need {Math.max(0, Math.ceil(minBalance - humanBalance)).toLocaleString()} more
          </p>
          <a
            href={`https://aerodrome.finance/swap?from=0x4200000000000000000000000000000000000006&to=${CLAUDIA_CONTRACT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent hover:bg-accent/80 text-white font-heading font-bold
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
