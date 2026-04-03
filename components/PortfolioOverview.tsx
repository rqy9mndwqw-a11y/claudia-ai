"use client";

import { useState, useCallback } from "react";
import type { Position } from "@/lib/protocol-adapters";
import PositionCard from "./PositionCard";
import { PositionSkeleton } from "./ui/Skeleton";

interface PortfolioOverviewProps {
  positions: Position[];
  totalValue: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  sessionToken: string | null | undefined;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function PortfolioOverview({
  positions,
  totalValue,
  isLoading,
  error,
  refresh,
  sessionToken,
}: PortfolioOverviewProps) {
  const [claudiaCheck, setClaudiaCheck] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleHealthCheck = useCallback(async () => {
    if (!sessionToken || positions.length === 0) return;
    setIsChecking(true);
    setClaudiaCheck(null);

    try {
      const res = await fetch("/api/claudia/portfolio-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          positions: positions.map((p) => ({
            protocol: p.protocol,
            pool: p.pool,
            tokens: p.tokens,
            currentValue: p.currentValue,
            apy: p.apy,
            chain: p.chain,
            balance: p.balance,
          })),
          totalValue,
        }),
      });

      const data = await (res.json() as Promise<any>).catch(() => null);
      if (res.ok && data?.content) {
        setClaudiaCheck(data.content);
      } else {
        setClaudiaCheck(data?.error || "Claudia had nothing to say.");
      }
    } catch {
      setClaudiaCheck("Couldn't reach Claudia. Try again.");
    } finally {
      setIsChecking(false);
    }
  }, [sessionToken, positions, totalValue]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5 text-center">
          <p className="text-zinc-400 mb-4 italic">&ldquo;{error}&rdquo;</p>
          <button
            onClick={refresh}
            className="bg-accent hover:bg-accent/80 text-white font-heading font-bold px-6 py-3 rounded-xl transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Summary */}
      <div className="px-5 py-4 border-b border-white/5 bg-surface/20">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Total Value</p>
            <p className="text-white font-heading font-bold text-2xl">{formatUsd(totalValue)}</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Positions</p>
            <p className="text-white font-heading font-bold text-2xl">{positions.length}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={handleHealthCheck}
              disabled={isChecking || positions.length === 0}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                isChecking
                  ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                  : "bg-accent/10 text-accent hover:bg-accent hover:text-white"
              }`}
            >
              {isChecking ? "Checking..." : "Ask Claudia"}
            </button>
            <button
              onClick={refresh}
              disabled={isLoading}
              className="text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-30"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Claudia's health check */}
      {(claudiaCheck || isChecking) && (
        <div className="mx-5 mt-3 bg-surface rounded-xl border border-accent/20 overflow-hidden" role="status" aria-live="polite">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-accent/5">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isChecking ? "bg-accent animate-pulse" : "bg-accent"}`} />
              <span className="text-xs font-heading font-bold text-accent">Portfolio Check</span>
            </div>
            {!isChecking && (
              <button
                onClick={() => setClaudiaCheck(null)}
                className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                dismiss
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            {isChecking ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border border-accent border-t-transparent" />
                <span className="text-xs text-zinc-500 italic">reviewing your positions...</span>
              </div>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed">{claudiaCheck}</p>
            )}
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="p-5 space-y-3">
        {isLoading && positions.length === 0 ? (
          <PositionSkeleton />
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-zinc-400 text-sm">nothing here yet.</p>
            <p className="text-zinc-600 text-xs">
              deposit into Aave or Aerodrome then come back.{" "}
              <a href="/defi" className="text-accent hover:underline">DeFi page &rarr;</a>
            </p>
          </div>
        ) : (
          positions.map((pos, i) => (
            <PositionCard key={`${pos.tokenAddress}-${i}`} position={pos} />
          ))
        )}
      </div>
    </div>
  );
}
