"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";

const GOVERNANCE_WEIGHTS = [
  { tier: "Oracle", weight: 5, color: "text-red-400", supply: "12" },
  { tier: "Legendary", weight: 3, color: "text-amber-400", supply: "50" },
  { tier: "Epic", weight: 1, color: "text-purple-400", supply: "200" },
  { tier: "Rare", weight: 0, color: "text-blue-400", supply: "500" },
  { tier: "Common", weight: 0, color: "text-zinc-400", supply: "∞" },
];

const PROPOSAL_TYPES = [
  { type: "New Token", desc: "Add a token to the Alpha Race rotation" },
  { type: "Battle Type", desc: "Propose a new battle format" },
  { type: "New Skill", desc: "Suggest a skill addition with max level" },
  { type: "Rule Change", desc: "Modify signal strength deltas, payout rates" },
];

export default function GovernancePage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏛️</span>
            <h1 className="font-heading text-2xl font-bold text-white tracking-tight">
              Arena Governance
            </h1>
          </div>
          <p className="text-zinc-600 text-sm">
            Legendary and Oracle NFT holders shape the rules of the Signal Pit.
          </p>
        </div>

        {/* Voting weights */}
        <div className="mb-8">
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Voting Power</h2>
          <div className="grid grid-cols-5 gap-2">
            {GOVERNANCE_WEIGHTS.map((g) => (
              <div key={g.tier} className="bg-surface rounded-lg border border-white/[0.06] p-3 text-center">
                <div className={`text-xs font-mono ${g.color} mb-1`}>{g.tier}</div>
                <div className="text-white/80 text-lg font-heading font-bold">
                  {g.weight > 0 ? `${g.weight}×` : "—"}
                </div>
                <div className="text-zinc-700 text-[9px] font-mono">{g.supply} supply</div>
              </div>
            ))}
          </div>
          <p className="text-zinc-700 text-[10px] font-mono mt-2">
            Quorum: 30% of eligible weight · Pass threshold: 60% yes by weight
          </p>
        </div>

        {/* What can be proposed */}
        <div className="mb-8">
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Proposal Types</h2>
          <div className="grid grid-cols-2 gap-3">
            {PROPOSAL_TYPES.map((p) => (
              <div key={p.type} className="bg-surface rounded-lg border border-white/[0.06] p-4">
                <div className="text-white/80 text-sm font-medium mb-1">{p.type}</div>
                <div className="text-zinc-600 text-[11px]">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active proposals — empty state */}
        <div className="mb-8">
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Active Proposals</h2>
          <div className="bg-surface rounded-lg border border-white/[0.06] p-8 text-center">
            <div className="text-2xl mb-3">🏛️</div>
            <p className="text-zinc-500 text-sm mb-2">No active proposals.</p>
            <p className="text-zinc-700 text-xs">
              Governance opens with the Signal Pit Season 01 launch.
              <br />Legendary and Oracle NFT holders can submit proposals.
            </p>
          </div>
        </div>

        {/* Implemented changes — empty state */}
        <div>
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Implemented Changes</h2>
          <div className="bg-surface rounded-lg border border-white/[0.06] p-6 text-center">
            <p className="text-zinc-600 text-xs">No changes implemented yet. History will appear here.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
