"use client";

import type { Pool } from "@/hooks/usePools";
import { supportsDeposit } from "@/lib/defi-adapters";

interface PoolCardProps {
  pool: Pool;
  isAnalyzing: boolean;
  onAnalyze: (pool: Pool) => void;
  onDeposit?: (pool: Pool) => void;
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M`;
  return `$${(tvl / 1_000).toFixed(0)}K`;
}

function getRiskColor(pool: Pool): string {
  if (pool.riskScore === "trash") return "border-l-red-500/50";
  if (pool.riskScore === "risky") return "border-l-orange-500/50";
  if (pool.riskScore === "moderate") return "border-l-yellow-500/40";
  if (pool.riskScore === "safe") return "border-l-green-500/30";
  // Fallback when no risk score
  if (pool.outlierApy || pool.apy > 100) return "border-l-red-500/50";
  if (pool.ilRisk || pool.apy >= 30) return "border-l-yellow-500/40";
  return "border-l-green-500/30";
}

const RISK_BADGE_STYLES: Record<string, string> = {
  safe: "bg-green-500/10 text-green-400",
  moderate: "bg-yellow-500/10 text-yellow-400",
  risky: "bg-orange-500/10 text-orange-400",
  trash: "bg-red-500/10 text-red-400",
};

export default function PoolCard({ pool, isAnalyzing, onAnalyze, onDeposit }: PoolCardProps) {
  return (
    <div
      className={`bg-surface/50 rounded-xl border border-white/5 border-l-[3px] ${getRiskColor(pool)}
                  hover:bg-surface hover:border-white/10 transition-all duration-300
                  ${isAnalyzing ? "ring-1 ring-accent/40 shadow-lg shadow-accent/10" : ""}`}
    >
      <div className="p-4">
        {/* Header: protocol + chain badge */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-heading font-bold text-white text-sm truncate">
                {pool.protocol}
              </h4>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                  pool.chain === "Base"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-purple-500/10 text-purple-400"
                }`}
              >
                {pool.chain.toUpperCase()}
              </span>
            </div>
            <p className="text-zinc-500 text-[11px] truncate font-medium">{pool.symbol}</p>
          </div>

          {/* Hero APY */}
          <div className="text-right flex-shrink-0 ml-3">
            <p
              className={`text-xl font-heading font-black leading-none ${
                pool.apy >= 50 ? "text-accent" : "text-white"
              }`}
            >
              {pool.apy.toFixed(1)}%
            </p>
            <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-tighter">APY</p>
          </div>
        </div>

        {/* TVL + Status badges */}
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          <span className="text-zinc-400 text-[11px] font-medium bg-white/5 px-2 py-0.5 rounded">
            TVL {formatTvl(pool.tvlUsd)}
          </span>
          {pool.claudiaPick && (
            <span className="bg-accent/15 text-accent px-1.5 py-0.5 rounded text-[10px] font-bold">
              CLAUDIA&apos;S PICK
            </span>
          )}
          {pool.riskScore && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${RISK_BADGE_STYLES[pool.riskScore]}`}>
              {pool.riskScore.toUpperCase()}
            </span>
          )}
          {pool.audited && (
            <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
              AUDITED
            </span>
          )}
          {pool.protocolAge != null && (
            <span className="text-zinc-500 text-[10px]">
              {pool.protocolAge}y old
            </span>
          )}
          {pool.stablecoin && (
            <span className="bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
              STABLE
            </span>
          )}
          {pool.ilRisk && (
            <span className="bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
              IL RISK
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          {supportsDeposit(pool.protocol) && onDeposit && (
            <button
              onClick={() => onDeposit(pool)}
              className="text-[11px] font-bold uppercase tracking-wider rounded-lg py-2.5 px-3 transition-all
                         bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white"
            >
              Deposit
            </button>
          )}
          <button
            onClick={() => onAnalyze(pool)}
            disabled={isAnalyzing}
            className={`flex-1 text-[11px] font-bold uppercase tracking-wider rounded-lg py-2.5 transition-all ${
              isAnalyzing
                ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                : "bg-accent/5 text-accent hover:bg-accent hover:text-white"
            }`}
          >
            {isAnalyzing ? "Thinking..." : "Ask Claudia"}
          </button>
          <a
            href={pool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold uppercase text-zinc-500 hover:text-white bg-surface-light hover:bg-white/10
                       px-3 py-2.5 rounded-lg transition-colors"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
