"use client";

import { useAccount, useReadContracts } from "wagmi";
import { CLAUDIA_CONTRACT, ERC20_ABI, MIN_CLAUDIA_BALANCE } from "@/lib/contracts";
import { formatUnits } from "viem";

interface TokenGateProps {
  children: React.ReactNode;
}

export default function TokenGate({ children }: TokenGateProps) {
  const { address, isConnected } = useAccount();

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: CLAUDIA_CONTRACT,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
      },
      {
        address: CLAUDIA_CONTRACT,
        abi: ERC20_ABI,
        functionName: "decimals",
      },
    ],
    query: { enabled: isConnected && !!address },
  });

  if (!isConnected) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const rawBalance = data?.[0]?.result as bigint | undefined;
  const decimals = (data?.[1]?.result as number | undefined) ?? 18;
  const balance = rawBalance ?? 0n;
  const humanBalance = Number(formatUnits(balance, decimals));
  const minRequired = Number(MIN_CLAUDIA_BALANCE);
  const hasAccess = humanBalance >= minRequired;

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
              {minRequired.toLocaleString()} $CLAUDIA
            </span>{" "}
            to access Claudia AI.
          </p>
          <p className="text-zinc-500 text-sm mb-6">
            Your balance: {humanBalance.toLocaleString()} $CLAUDIA
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
