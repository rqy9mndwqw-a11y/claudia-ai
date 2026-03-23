"use client";

import { useState, useCallback } from "react";
import type { Pool, ChainFilter, SortBy, PoolsState } from "@/hooks/usePools";
import PoolCard from "./PoolCard";
import ClaudiaCharacter from "./ClaudiaCharacter";
import { useClaudiaMood } from "@/hooks/useClaudiaMood";

interface PoolDashboardProps {
  poolsState: PoolsState;
}

function formatTotalTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
  return `$${(tvl / 1_000_000).toFixed(0)}M`;
}

const CHAIN_OPTIONS: { value: ChainFilter; label: string }[] = [
  { value: "all", label: "All Chains" },
  { value: "Base", label: "Base" },
  { value: "Ethereum", label: "Ethereum" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "apy", label: "APY" },
  { value: "tvl", label: "TVL" },
  { value: "apyBase", label: "Base APY" },
];

export default function PoolDashboard({ poolsState }: PoolDashboardProps) {
  const { filteredPools, filters, setFilters, isLoading, error, refresh, isAnalyzing, setIsAnalyzing, hasHighApy, hasRiskyPools } = poolsState;
  const [analyzingPoolId, setAnalyzingPoolId] = useState<string | null>(null);
  const [claudiaMessage, setClaudiaMessage] = useState<string | undefined>(undefined);

  const claudiaMood = useClaudiaMood({
    walletConnected: true,
    loadingData: isLoading,
    pools: filteredPools.map((p) => ({
      apy: p.apy,
      tvlUsd: p.tvlUsd,
      riskFlags: p.outlierApy || p.ilRisk,
    })),
    aiResponding: isAnalyzing,
  });

  const handleAnalyze = useCallback(async (pool: Pool) => {
    setAnalyzingPoolId(pool.id);
    setIsAnalyzing(true);
    setClaudiaMessage("");

    try {
      const res = await fetch("/api/claudia/analyze-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setClaudiaMessage(
          data?.error || "I had thoughts on this one but they didn't survive the trip. Try clicking again."
        );
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) {
        setClaudiaMessage("I had thoughts on this one but they didn't survive the trip. Try clicking again.");
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setClaudiaMessage(fullText);
      }
    } catch {
      setClaudiaMessage("I had thoughts on this one but they didn't survive the trip. Try clicking again.");
    } finally {
      setIsAnalyzing(false);
      setAnalyzingPoolId(null);
    }
  }, [setIsAnalyzing]);

  // Summary stats
  const totalTvl = filteredPools.reduce((sum, p) => sum + p.tvlUsd, 0);
  const highestApy = filteredPools.length > 0 ? filteredPools.reduce((max, p) => (p.apy > max.apy ? p : max), filteredPools[0]) : null;

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
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5 flex-wrap">
          <span className="text-zinc-500 text-xs">
            <span className="text-white font-bold">{filteredPools.length}</span> pools
          </span>
          {highestApy && (
            <span className="text-zinc-500 text-xs">
              Top: <span className="text-accent font-bold">{highestApy.apy}%</span>{" "}
              <span className="text-zinc-400">{highestApy.protocol} {highestApy.symbol}</span>
            </span>
          )}
          <span className="text-zinc-500 text-xs">
            TVL: <span className="text-white font-bold">{formatTotalTvl(totalTvl)}</span>
          </span>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="ml-auto text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-30"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Chain filter */}
            {CHAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ chain: opt.value })}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  filters.chain === opt.value
                    ? "bg-accent text-white"
                    : "bg-surface-light text-zinc-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Sort */}
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ sortBy: opt.value })}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  filters.sortBy === opt.value
                    ? "bg-surface-light text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick filter chips */}
            {[
              { key: "stablecoinsOnly" as const, label: "Stablecoins", active: filters.stablecoinsOnly },
              { key: "hideOutliers" as const, label: "Hide Outliers", active: filters.hideOutliers },
              { key: "hideIlRisk" as const, label: "Hide IL Risk", active: filters.hideIlRisk },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilters({ [chip.key]: !chip.active })}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  chip.active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {chip.label}
              </button>
            ))}

            {/* Search */}
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Search protocol or token..."
              className="ml-auto text-xs bg-surface border border-white/10 rounded-lg px-3 py-1.5
                         text-white placeholder-zinc-600 outline-none focus:border-accent/30
                         w-48 transition-colors"
            />
          </div>
        </div>

        {/* Pool grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
            </div>
          ) : filteredPools.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-zinc-500 text-sm">No pools match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  isAnalyzing={analyzingPoolId === pool.id}
                  onAnalyze={handleAnalyze}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CLAUDIA sidebar */}
      <div className="hidden lg:flex flex-col items-center w-52 border-l border-white/5 bg-surface/30 pt-6 flex-shrink-0">
        <ClaudiaCharacter
          imageSrc="/claudia-avatar.png"
          mood={claudiaMood}
          message={claudiaMessage}
        />
      </div>
    </div>
  );
}
