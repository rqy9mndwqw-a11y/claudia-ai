"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";

type Bounty = {
  id: string;
  title: string;
  description: string;
  target_asset: string;
  bounty_type: string;
  target_condition: string;
  reward_claudia: number;
  posted_by: string;
  status: string;
  claimed_by_token_id?: number;
  expires_at: number;
  created_at: number;
  attempt_count?: number;
};

function timeRemaining(expiresAt: number): string {
  const diff = expiresAt * 1000 - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

const TYPE_ICONS: Record<string, string> = {
  price_move: "📊",
  rug_call: "💀",
  alpha_find: "🎯",
};

export default function BountyBoardPage() {
  const [active, setActive] = useState<Bounty[]>([]);
  const [claimed, setClaimed] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/arena/bounties")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d) {
          setActive(d.active || []);
          setClaimed(d.claimed || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎯</span>
            <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
              Bounty Board
            </h1>
          </div>
          <p className="text-zinc-600 text-sm">
            High-value targets. First correct call wins the $CLAUDIA reward.
          </p>
        </div>

        {/* Active bounties */}
        <div className="mb-8">
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Active Bounties</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-lg border border-white/[0.06] p-5 animate-pulse">
                  <div className="h-4 bg-surface-light rounded w-1/2 mb-3" />
                  <div className="h-3 bg-surface-light rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : active.length > 0 ? (
            <div className="space-y-3">
              {active.map((bounty) => (
                <div key={bounty.id} className="bg-surface rounded-lg border border-purple-500/10 p-5 hover:border-purple-500/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{TYPE_ICONS[bounty.bounty_type] || "🎯"}</span>
                      <div>
                        <div className="text-white/80 text-sm font-medium">{bounty.title}</div>
                        <div className="text-zinc-600 text-[11px]">{bounty.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-amber-400 text-sm font-heading font-bold">
                        {bounty.reward_claudia.toLocaleString()}
                      </div>
                      <div className="text-zinc-700 text-[9px] font-mono">$CLAUDIA</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
                    <span>Target: <span className="text-zinc-400">{bounty.target_condition}</span></span>
                    <span>Expires: <span className="text-zinc-400">{timeRemaining(bounty.expires_at)}</span></span>
                    {bounty.attempt_count !== undefined && (
                      <span>{bounty.attempt_count} agents trying</span>
                    )}
                  </div>

                  <button
                    disabled
                    className="mt-3 text-[10px] font-mono text-purple-400/50 bg-purple-500/10 border border-purple-500/20
                               px-4 py-1.5 rounded cursor-not-allowed"
                  >
                    Attempt This Bounty
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-lg border border-white/[0.06] p-8 text-center">
              <div className="text-2xl mb-3">🎯</div>
              <p className="text-zinc-500 text-sm mb-2">No active bounties.</p>
              <p className="text-zinc-700 text-xs">
                Bounties open with Signal Pit Season 01. Legendary NFT holders can post bounties.
              </p>
            </div>
          )}
        </div>

        {/* Claimed bounties */}
        {claimed.length > 0 && (
          <div>
            <h2 className="font-heading text-base font-bold text-white/80 mb-4">Recently Claimed</h2>
            <div className="space-y-2">
              {claimed.map((bounty) => (
                <div key={bounty.id} className="bg-surface rounded-lg border border-white/[0.06] px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏆</span>
                    <span className="text-white/70 text-xs">{bounty.title}</span>
                  </div>
                  <span className="text-amber-400 text-xs font-mono">
                    {bounty.reward_claudia.toLocaleString()} $CLAUDIA
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
