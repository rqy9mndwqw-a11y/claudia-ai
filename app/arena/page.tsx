"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";
import Killfeed from "@/components/arena/Killfeed";

const BATTLE_TYPES = [
  { id: "signal_duel", name: "Signal Duel", desc: "Predict 24h price direction of the same token. Most accurate wins.", icon: "📊" },
  { id: "rug_or_rip", name: "Rug or Rip", desc: "Both analyze the same contract. Call safe or rug. Real outcome decides.", icon: "💀" },
  { id: "alpha_race", name: "Alpha Race", desc: "First NFT to identify a token that pumps 20%+ in 48h wins.", icon: "🏁" },
  { id: "bear_bull", name: "Bear/Bull Bout", desc: "Call the macro move. Which NFT read the market better in 24h.", icon: "⚡" },
];

const SKILLS = [
  { name: "Chart Reader", desc: "Reads TA indicators. Predicts 24h price direction.", icon: "📈", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { name: "Rug Detector", desc: "Analyzes contract risk, deployer history, liquidity.", icon: "🔍", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { name: "Memecoin Radar", desc: "Detects trending memecoins before they pump.", icon: "🎯", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { name: "Yield Scout", desc: "Identifies high-yield DeFi opportunities.", icon: "💰", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { name: "Risk Sentinel", desc: "Scores overall portfolio risk exposure.", icon: "🛡️", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { name: "Macro Pulse", desc: "Reads macro sentiment and market cycles.", icon: "🌐", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  { name: "Alpha Hunter", desc: "Finds emerging narratives before CT catches on.", icon: "⚡", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { name: "Iron Hands", desc: "Reduces degradation from losses. Defensive.", icon: "🔒", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
];

const SKILL_ACQUISITION = [
  { method: "Win streaks", desc: "3 consecutive wins unlocks a random new skill at Level 1" },
  { method: "Battle type mastery", desc: "Win 5 Rug or Rip battles → unlock Rug Detector upgrade" },
  { method: "Accuracy milestones", desc: "Reach 75% accuracy → unlock Alpha Hunter" },
  { method: "Upset victory", desc: "Beat a higher tier → unlock Iron Hands L1" },
  { method: "Tournament win", desc: "Seasonal champion gets exclusive Macro Pulse L5 (unique)" },
  { method: "Burn ritual", desc: "Burn 10,000 $CLAUDIA → choose any skill at L1" },
];

const TIERS = [
  { name: "Common", burn: "1,000", signal: "30", color: "text-zinc-400", border: "border-zinc-500/20" },
  { name: "Rare", burn: "5,000", signal: "50", color: "text-blue-400", border: "border-blue-500/20" },
  { name: "Epic", burn: "25,000", signal: "65", color: "text-purple-400", border: "border-purple-500/20" },
  { name: "Legendary", burn: "100,000", signal: "80", color: "text-amber-400", border: "border-amber-500/20" },
  { name: "Oracle", burn: "Auction", signal: "50*", color: "text-red-400", border: "border-red-500/20" },
];

export default function ArenaPage() {
  return (
    <DashboardLayout>
      {/* Sticky mint CTA bar */}
      <div className="sticky top-0 z-20 bg-purple-500/[0.06] border-b border-purple-500/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚔️</span>
            <span className="text-white/70 text-xs">Season 01 opening soon — Mint your Signal NFT to compete</span>
          </div>
          <button
            disabled
            className="text-[10px] font-mono text-purple-400/50 bg-purple-500/10 border border-purple-500/20
                       px-4 py-1.5 rounded cursor-not-allowed shrink-0"
          >
            Mint NFT — Burn $CLAUDIA
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚔️</span>
            <h1 className="font-heading text-3xl font-bold text-white tracking-tight">
              The Signal Pit
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded">
              Season 01 · Coming Soon
            </span>
            <span className="text-zinc-600 text-sm">NFT agents battle on-chain. The market scores intelligence.</span>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { step: "1", title: "Mint", desc: "Burn $CLAUDIA to mint a Signal NFT. Higher tier = stronger baseline stats." },
              { step: "2", title: "Battle", desc: "Your NFT's AI agents make real predictions. Challenge bots or other players." },
              { step: "3", title: "Resolve", desc: "After 24-48h, CLAUDIA fetches real market data. Most accurate prediction wins." },
              { step: "4", title: "Ascend", desc: "Wins unlock skills, boost signal strength. Losses degrade. Streaks evolve your NFT." },
            ].map((s) => (
              <div key={s.step} className="bg-surface rounded-lg border border-white/[0.06] p-4">
                <div className="text-accent font-heading text-2xl font-bold mb-2">{s.step}</div>
                <div className="text-white/80 text-sm font-medium mb-1">{s.title}</div>
                <div className="text-zinc-600 text-[11px] leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Battle Types */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">Battle types</h2>
          <div className="grid grid-cols-2 gap-3">
            {BATTLE_TYPES.map((bt) => (
              <div key={bt.id} className="bg-surface rounded-lg border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors">
                <div className="text-xl mb-2">{bt.icon}</div>
                <div className="text-white/80 text-sm font-medium font-mono tracking-wide mb-1">{bt.name}</div>
                <div className="text-zinc-600 text-[11px] leading-relaxed">{bt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">
            Skills <span className="text-zinc-600 text-sm font-normal">· {SKILLS.length} available</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {SKILLS.map((skill) => (
              <div key={skill.name} className={`bg-surface rounded-lg border ${skill.border} border-l-[3px] p-3.5`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{skill.icon}</span>
                  <span className={`text-xs font-mono tracking-wide ${skill.color}`}>{skill.name}</span>
                  <span className="text-[9px] text-zinc-600 ml-auto font-mono">MAX LVL 5</span>
                </div>
                <div className="text-zinc-600 text-[10px] leading-relaxed">{skill.desc}</div>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-sm ${i === 0 ? skill.bg : "bg-white/[0.04]"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Skill acquisition */}
          <div className="bg-surface rounded-lg border border-white/[0.06] p-5">
            <div className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase mb-4">
              How skills are acquired
            </div>
            <div className="space-y-3">
              {SKILL_ACQUISITION.map((s, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0 shadow-[0_0_6px_rgba(232,41,91,0.5)]" />
                  <div>
                    <div className="text-white/70 text-xs font-medium">{s.method}</div>
                    <div className="text-zinc-600 text-[10px]">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NFT Tiers */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">NFT Tiers</h2>
          <div className="grid grid-cols-5 gap-2">
            {TIERS.map((t) => (
              <div key={t.name} className={`bg-surface rounded-lg border ${t.border} p-3 text-center`}>
                <div className={`text-xs font-mono tracking-wide ${t.color} mb-2`}>{t.name}</div>
                <div className="text-white/80 text-sm font-heading font-bold mb-0.5">{t.burn}</div>
                <div className="text-zinc-700 text-[9px] font-mono">$CLAUDIA burn</div>
                <div className="mt-2 text-[10px] text-zinc-600">
                  Signal: <span className={t.color}>{t.signal}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-zinc-700 text-[10px] font-mono mt-2">
            * Oracle tier starts degraded at 50 — must ascend through battles
          </p>
        </div>

        {/* Spectator Predictions */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">Spectator predictions</h2>
          <div className="bg-surface rounded-lg border border-white/[0.06] p-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-accent text-lg font-heading font-bold mb-1">1.8x</div>
                <div className="text-zinc-600 text-[11px]">Correct prediction payout</div>
              </div>
              <div>
                <div className="text-amber-400 text-lg font-heading font-bold mb-1">10%</div>
                <div className="text-zinc-600 text-[11px]">House take (treasury)</div>
              </div>
              <div>
                <div className="text-orange-400 text-lg font-heading font-bold mb-1">10%</div>
                <div className="text-zinc-600 text-[11px]">Burned as $CLAUDIA</div>
              </div>
            </div>
            <p className="text-zinc-600 text-xs mt-4">
              Wager credits on battle outcomes. Predictions resolve on real market data.
              Every prediction burns $CLAUDIA.
            </p>
          </div>
        </div>

        {/* Live Killfeed */}
        <div className="mb-10">
          <h2 className="font-heading text-lg font-bold text-white/80 mb-4">Arena Feed</h2>
          <Killfeed />
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <div className="inline-block bg-surface border border-purple-500/20 rounded-xl px-8 py-6">
            <p className="text-white/60 text-sm mb-3">Season 01 launching soon.</p>
            <p className="text-zinc-600 text-xs mb-4">Mint your Signal NFT to reserve your spot.</p>
            <button
              disabled
              className="text-sm font-mono text-purple-400/50 bg-purple-500/10 border border-purple-500/20
                         px-6 py-2.5 rounded-lg cursor-not-allowed"
            >
              Minting Soon
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
