"use client";

import type { Position } from "@/lib/protocol-adapters";

interface PositionCardProps {
  position: Position;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function PositionCard({ position }: PositionCardProps) {
  return (
    <div className="bg-surface/50 rounded-xl border border-white/5 border-l-[3px] border-l-green-500/30
                    hover:bg-surface hover:border-white/10 transition-all duration-300 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-heading font-bold text-white text-sm">{position.protocol}</h4>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-400">
              {position.chain.toUpperCase()}
            </span>
          </div>
          <p className="text-zinc-500 text-[11px] font-medium">{position.pool}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-heading font-bold text-lg">{formatUsd(position.currentValue)}</p>
          {position.apy != null && (
            <p className="text-accent text-xs font-bold">{position.apy.toFixed(1)}% APY</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="flex items-center gap-3 text-xs">
        <div className="bg-white/5 rounded-lg px-3 py-1.5">
          <span className="text-zinc-500">Balance: </span>
          <span className="text-white font-medium">
            {parseFloat(position.balance).toFixed(4)} {position.tokens[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
