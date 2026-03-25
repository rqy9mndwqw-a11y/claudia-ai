"use client";

interface YieldCardProps {
  project: string;
  symbol: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number;
  stablecoin: boolean;
  poolMeta: string | null;
  onAsk?: (project: string, symbol: string, apy: number) => void;
}

export default function YieldCard({
  project,
  symbol,
  apy,
  apyBase,
  apyReward,
  tvlUsd,
  stablecoin,
  poolMeta,
  onAsk,
}: YieldCardProps) {
  const tvlStr =
    tvlUsd >= 1_000_000_000
      ? `$${(tvlUsd / 1_000_000_000).toFixed(1)}B`
      : `$${(tvlUsd / 1_000_000).toFixed(1)}M`;

  return (
    <div className="bg-surface rounded-xl p-4 border border-white/5 hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-heading font-bold text-white text-sm">
            {project}
          </h4>
          <p className="text-zinc-500 text-xs">
            {symbol}
            {poolMeta && ` · ${poolMeta}`}
          </p>
        </div>
        <span
          className={`text-lg font-heading font-bold ${
            apy >= 10 ? "text-accent" : "text-coral"
          }`}
        >
          {apy}%
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
        <span>TVL {tvlStr}</span>
        {apyBase != null && <span>Base {apyBase}%</span>}
        {apyReward != null && <span>Rewards {apyReward}%</span>}
        {stablecoin && (
          <span className="bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded text-[11px]">
            Stable
          </span>
        )}
      </div>

      {onAsk && (
        <button
          onClick={() => onAsk(project, symbol, apy)}
          className="w-full text-xs text-accent hover:text-white bg-accent/10 hover:bg-accent/20
                     rounded-lg py-1.5 transition-colors font-medium"
        >
          Ask Claudia about this
        </button>
      )}
    </div>
  );
}
