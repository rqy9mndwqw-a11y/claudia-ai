"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";

const STEPS = [
  { num: "1", title: "Connect Wallet", desc: "Connect any EVM wallet via RainbowKit. Works with MetaMask, Coinbase Wallet, and more." },
  { num: "2", title: "Hold 500K $CLAUDIA", desc: "Buy on Aerodrome Finance or any supported DEX on Base. Hold in the same wallet you connect." },
  { num: "3", title: "Create Your Agent", desc: "Name it, write a system prompt, set the price. Your agent goes live instantly on the marketplace." },
  { num: "4", title: "Earn Credits", desc: "Every time someone chats with your agent, you earn 80% of the credits they spend. Platform keeps 20%." },
];

const TIPS = [
  { title: "Be specific", desc: "Agents with a clear niche outperform generic ones. 'Base yield farming specialist' beats 'generic helper.'" },
  { title: "Write a strong system prompt", desc: "This is your agent's brain. Be detailed about tone, expertise areas, and what NOT to do. 200+ words works best." },
  { title: "Set fair pricing", desc: "1-3 credits for simple agents, 5-10 for premium research. Underpricing kills perceived value." },
  { title: "Pick the right model", desc: "Standard (8B) is fast and cheap. Premium (70B) gives deeper answers but costs 5x. Match model to complexity." },
  { title: "Test your own agent", desc: "Creators can chat with their own agents for free. Test thoroughly before publishing." },
];

const AGENT_IDEAS = [
  { icon: "🔍", name: "Protocol Auditor", desc: "Analyzes smart contracts and flags common vulnerabilities" },
  { icon: "📊", name: "Portfolio Rebalancer", desc: "Suggests optimal allocation based on risk tolerance" },
  { icon: "🐋", name: "Whale Tracker", desc: "Analyzes wallet behavior and identifies smart money moves" },
  { icon: "📰", name: "Alpha Aggregator", desc: "Summarizes CT, governance forums, and on-chain signals" },
  { icon: "🎓", name: "Market Tutor", desc: "Explains complex concepts for beginners with examples" },
  { icon: "⚡", name: "Gas Optimizer", desc: "Suggests best times and strategies to minimize gas costs" },
];

export default function CreatorGuidePage() {
  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-10 space-y-12">

          {/* Hero */}
          <div className="text-center">
            <div className="text-4xl mb-4">🛠</div>
            <h1 className="font-heading font-bold text-white text-2xl mb-2">Creator Guide</h1>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
              Build AI agents that earn for you. Your agent runs 24/7 on the CLAUDIA marketplace
              and earns credits every time someone uses it.
            </p>
          </div>

          {/* Steps */}
          <div>
            <h2 className="font-heading font-bold text-white text-lg mb-6">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STEPS.map((s) => (
                <div key={s.num} className="bg-surface rounded-xl border border-white/5 p-5 flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent font-heading font-bold text-sm">{s.num}</span>
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-white text-sm mb-1">{s.title}</h3>
                    <p className="text-zinc-500 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings breakdown */}
          <div className="bg-surface rounded-xl border border-white/5 p-6">
            <h2 className="font-heading font-bold text-white text-lg mb-4">Earnings Breakdown</h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="bg-bg rounded-lg p-4">
                <p className="text-accent font-heading font-bold text-2xl">80%</p>
                <p className="text-zinc-500 text-xs mt-1">Goes to you</p>
              </div>
              <div className="bg-bg rounded-lg p-4">
                <p className="text-zinc-400 font-heading font-bold text-2xl">20%</p>
                <p className="text-zinc-500 text-xs mt-1">Platform fee</p>
              </div>
              <div className="bg-bg rounded-lg p-4">
                <p className="text-coral font-heading font-bold text-2xl">50%</p>
                <p className="text-zinc-500 text-xs mt-1">Of purchase burned</p>
              </div>
            </div>
            <p className="text-zinc-600 text-xs leading-relaxed">
              When someone buys credits, 50% of their $CLAUDIA is burned permanently. When they spend credits
              on your agent, you receive 80% of the credits spent. Credits can be used to chat with other agents
              or accumulated as earnings.
            </p>
          </div>

          {/* Tips */}
          <div>
            <h2 className="font-heading font-bold text-white text-lg mb-6">Tips for a Great Agent</h2>
            <div className="space-y-3">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-accent text-xs mt-0.5 flex-shrink-0">▸</span>
                  <div>
                    <span className="text-white text-sm font-bold">{tip.title}.</span>{" "}
                    <span className="text-zinc-400 text-sm">{tip.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent ideas */}
          <div>
            <h2 className="font-heading font-bold text-white text-lg mb-6">Agent Ideas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AGENT_IDEAS.map((idea, i) => (
                <div key={i} className="bg-surface/50 rounded-xl border border-white/5 p-4 flex gap-3">
                  <div className="text-xl flex-shrink-0">{idea.icon}</div>
                  <div>
                    <h3 className="text-white text-sm font-bold">{idea.name}</h3>
                    <p className="text-zinc-500 text-xs">{idea.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center py-8 border-t border-white/5">
            <a
              href="/agents/create"
              className="inline-block bg-accent hover:bg-[#27c00e] text-white font-heading font-bold
                         px-8 py-3 rounded-xl transition-all text-sm uppercase tracking-wider"
            >
              Create Your Agent
            </a>
            <p className="text-zinc-600 text-xs mt-3">Requires 500K $CLAUDIA held in connected wallet</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
