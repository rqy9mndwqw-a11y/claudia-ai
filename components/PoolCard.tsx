"use client";

import type { Pool } from "@/hooks/usePools";

interface PoolCardProps {
  pool: Pool;
  isAnalyzing: boolean;
  onAnalyze: (pool: Pool) => void;
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M`;
  return `$${(tvl / 1_000).toFixed(0)}K`;
}

function getRiskColor(pool: Pool): string {
  if (pool.outlierApy || pool.apy > 100) return "border-l-red-500";
  if (pool.ilRisk || pool.apy >= 30) return "border-l-yellow-500";
  return "border-l-green-500";
}

export default function PoolCard({ pool, isAnalyzing, onAnalyze }: PoolCardProps) {
  return (
    <div
      className={`bg-surface rounded-xl border border-white/5 border-l-[3px] ${getRiskColor(pool)}
                  hover:border-white/10 transition-all duration-300
                  ${isAnalyzing ? "ring-1 ring-accent/40 shadow-lg shadow-accent/10" : ""}`}
    >
      <div className="p-4">
        {/* Header: protocol + chain badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-heading font-bold text-white text-sm truncate">
                {pool.protocol}
              </h4>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                  pool.chain === "Base"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-purple-500/15 text-purple-400"
                }`}
              >
                {pool.chain}
              </span>
            </div>
            <p className="text-zinc-500 text-xs truncate">{pool.symbol}</p>
          </div>

          {/* Hero APY */}
          <div className="text-right flex-shrink-0 ml-3">
            <p
              className={`text-xl font-heading font-bold leading-none ${
                pool.apy >= 20 ? "text-accent" : pool.apy >= 10 ? "text-coral" : "text-white"
              }`}
            >
              {pool.apy.toFixed(1)}%
            </p>
            <p className="text-zinc-600 text-[10px]">APY</p>
          </div>
        </div>

        {/* APY breakdown */}
        {(pool.apyBase > 0 || pool.apyReward) && (
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mb-3">
            {pool.apyBase > 0 && <span>Base {pool.apyBase}%</span>}
            {pool.apyReward != null && pool.apyReward > 0 && (
              <span className="text-accent/70">+ Reward {pool.apyReward}%</span>
            )}
          </div>
        )}

        {/* TVL + badges */}
        <div className="flex items-center flex-wrap gap-1.5 mb-3">
          <span className="text-zinc-400 text-xs">
            TVL {formatTvl(pool.tvlUsd)}
          </span>
          {pool.stablecoin && (
            <span className="bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded text-[10px]">
              Stablecoin
            </span>
          )}
          {pool.ilRisk && (
            <span className="bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded text-[10px]">
              IL Risk
            </span>
          )}
          {pool.outlierApy && (
            <span className="bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded text-[10px]">
              Outlier
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAnalyze(pool)}
            disabled={isAnalyzing}
            className={`flex-1 text-xs font-medium rounded-lg py-2 transition-colors ${
              isAnalyzing
                ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                : "bg-accent/10 text-accent hover:bg-accent/20 hover:text-white"
            }`}
          >
            {isAnalyzing ? "Claudia is thinking..." : "Ask Claudia"}
          </button>
          <a
            href={pool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-white bg-surface-light hover:bg-white/10
                       px-3 py-2 rounded-lg transition-colors"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
