"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  walletAddress: string;
  walletShort: string;
  totalBurned?: number;
  seasonBurned?: number;
  burnCount: number;
  hallOfFlameRank: string;
  rankColor: string;
};

type LeaderboardData = {
  allTime: LeaderboardEntry[];
  season: LeaderboardEntry[];
  totalBurned: number;
};

const RANK_STYLES: Record<string, string> = {
  "Eternal Flame": "text-amber-300 bg-amber-500/10 border-amber-500/20",
  "Inferno": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Torch": "text-orange-300 bg-orange-400/10 border-orange-400/20",
  "Spark": "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function positionEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}`;
}

export default function HallOfFlamePage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [tab, setTab] = useState<"alltime" | "season">("alltime");

  useEffect(() => {
    fetch("/api/burn/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d as LeaderboardData); })
      .catch(() => {});
  }, []);

  const entries = tab === "alltime" ? data?.allTime : data?.season;

  return (
    <div className="min-h-screen bg-bg text-zinc-200">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.06)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-4">🔥</div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Hall of Flame
          </h1>
          <p className="text-zinc-500 text-sm">
            These wallets chose violence against the supply.
          </p>
        </div>

        {/* Total burned counter */}
        {data && (
          <div className="text-center mb-10">
            <div className="inline-block bg-surface border border-amber-500/20 rounded-xl px-8 py-5">
              <div className="text-[10px] font-mono text-amber-400/60 tracking-widest uppercase mb-2">
                Total $CLAUDIA Burned
              </div>
              <div className="font-heading text-3xl font-bold text-white">
                {Math.floor(data.totalBurned).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-white/[0.06]">
          {[
            { id: "alltime" as const, label: "All-Time Top 10" },
            { id: "season" as const, label: "This Season" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-xs font-mono tracking-wider transition-colors border-b-2 -mb-px cursor-pointer
                ${tab === t.id
                  ? "text-amber-400 border-amber-400"
                  : "text-zinc-600 border-transparent hover:text-zinc-400"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {!data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-surface rounded-lg border border-white/[0.06] p-4 animate-pulse">
                <div className="h-4 bg-surface-light rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (entries?.length || 0) > 0 ? (
          <div className="space-y-2">
            {entries!.map((entry) => {
              const burned = entry.totalBurned ?? entry.seasonBurned ?? 0;
              const style = RANK_STYLES[entry.hallOfFlameRank] || RANK_STYLES.Spark;
              return (
                <div
                  key={entry.walletAddress}
                  className={`flex items-center gap-4 bg-surface rounded-lg border border-white/[0.06] px-5 py-3.5
                    ${entry.rank <= 3 ? "border-amber-500/10" : ""}`}
                >
                  <div className={`w-8 text-center font-heading text-lg font-bold
                    ${entry.rank <= 3 ? "text-amber-400" : "text-zinc-600"}`}>
                    {positionEmoji(entry.rank)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-sm font-mono">{entry.walletShort}</span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${style}`}>
                        {entry.hallOfFlameRank}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-white/80 text-sm font-mono font-medium">
                      {Math.floor(burned).toLocaleString()}
                    </div>
                    <div className="text-zinc-700 text-[9px] font-mono">
                      {entry.burnCount} burns
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-white/[0.06] p-8 text-center">
            <p className="text-zinc-600 text-sm">No burns yet. Be the first.</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-10">
          <p className="text-zinc-600 text-sm mb-3">Burn $CLAUDIA to climb the ranks.</p>
          <a
            href="https://app.claudia.wtf/credits"
            className="inline-block bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 font-mono text-sm
                       px-6 py-2.5 rounded-lg border border-amber-500/20 transition-colors"
          >
            Buy Credits → Burn $CLAUDIA
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <a href="https://app.claudia.wtf" className="text-zinc-700 hover:text-zinc-400 text-xs font-mono transition-colors">
            claudia.wtf
          </a>
        </div>
      </div>
    </div>
  );
}
