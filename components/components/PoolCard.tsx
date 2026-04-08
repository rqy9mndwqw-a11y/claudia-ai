"use client";

import type { Pool } from "@/hooks/usePools";
import { supportsDeposit } from "@/lib/defi-adapters";
import Badge, { chainVariant, riskVariant } from "./ui/Badge";

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
  if (pool.outlierApy || pool.apy > 100) return "border-l-red-500/50";
  if (pool.ilRisk || pool.apy >= 30) return "border-l-yellow-500/40";
  return "border-l-green-500/30";
}

export default function PoolCard({ pool, isAnalyzing, onAnalyze, onDeposit }: PoolCardProps) {
  return (
    <div
      className={`bg-surface/50 rounded-xl border border-white/5 border-l-[3px] ${getRiskColor(pool)}
                  hover:bg-surface hover:border-white/10 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-200
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
              <Badge variant={chainVariant(pool.chain)} className="flex-shrink-0">
                {pool.chain.toUpperCase()}
              </Badge>
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
            <p className="text-zinc-600 text-[11px] font-bold uppercase tracking-tighter">APY</p>
          </div>
        </div>

        {/* TVL + Status badges */}
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          <Badge variant="neutral" size="md">TVL {formatTvl(pool.tvlUsd)}</Badge>
          {pool.claudiaPick && <Badge variant="pick">CLAUDIA&apos;S PICK</Badge>}
          {pool.riskScore && (
            <Badge variant={riskVariant(pool.riskScore)}>
              {pool.riskScore.toUpperCase()}
            </Badge>
          )}
          {pool.audited && <Badge variant="tag-audit" title="Audited protocol">AUDITED</Badge>}
          {pool.protocolAge != null && (
            <span className="text-zinc-500 text-[11px]">{pool.protocolAge}y old</span>
          )}
          {pool.stablecoin && <Badge variant="tag-stable">STABLE</Badge>}
          {pool.ilRisk && <Badge variant="tag-il">IL RISK</Badge>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          {supportsDeposit(pool.protocol) && onDeposit && (
            <button
              onClick={() => onDeposit(pool)}
              className="text-xs font-bold uppercase tracking-wider rounded-lg py-2.5 px-3 transition-all
                         bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white"
            >
              Deposit
            </button>
          )}
          <button
            onClick={() => onAnalyze(pool)}
            disabled={isAnalyzing}
            className={`flex-1 text-xs font-bold uppercase tracking-wider rounded-lg py-2.5 transition-all ${
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
            className="text-xs font-bold uppercase text-zinc-500 hover:text-white bg-surface-light hover:bg-white/10
                       px-3 py-2.5 rounded-lg transition-colors"
          >
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
