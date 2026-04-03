"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import { useBurnedAmount } from "@/hooks/useBurnedAmount";
import { AGENT_ID_TO_INFO } from "@/lib/marketplace/agent-routing";
import { AGENT_CREDIT_TIERS } from "@/lib/credits/agent-tiers";

const AERODROME_SWAP_URL =
  "https://aerodrome.finance/swap?from=0x4200000000000000000000000000000000000006&to=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

const AGENTS = Object.entries(AGENT_ID_TO_INFO).map(([id, info]) => ({
  id,
  ...info,
  credits: AGENT_CREDIT_TIERS[id] ?? 1,
}));

function AgentPreviewCard({ agent }: { agent: typeof AGENTS[number] }) {
  return (
    <div className="group relative bg-surface rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-all duration-200">
      <div className="absolute inset-0 rounded-xl bg-white/[0.01] group-hover:bg-purple-500/[0.04] transition-colors" />
      <div className="relative flex items-start gap-3">
        <span className="text-xl shrink-0 opacity-50 group-hover:opacity-80 transition-opacity">{agent.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/80 text-sm font-medium">{agent.name}</span>
            <span className="text-[10px] text-purple-400/60 bg-purple-500/10 px-1.5 py-0.5 rounded">
              {agent.credits} {agent.credits === 1 ? "credit" : "credits"}
            </span>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed">{agent.description}</p>
        </div>
        <div className="shrink-0 text-white/10 group-hover:text-white/20 transition-colors" title="Connect to unlock">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { burned } = useBurnedAmount();
  const [stats, setStats] = useState<{ holders?: number; totalMessages?: number } | null>(null);

  useEffect(() => {
    if (isConnected) {
      router.push("/chat");
    }
  }, [isConnected, router]);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.ok ? r.json() as Promise<any> : null)
      .then((d: any) => d && setStats({ holders: d.holders, totalMessages: d.totalMessages }))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pb-20">
      <div className="fixed inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />

      {/* ── Hero (untouched) ── */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl pt-[20vh]">
        <div className="w-24 h-24 rounded-full bg-surface border-2 border-accent/30 flex items-center justify-center mb-8 glow">
          <img
            src="/claudia-logo.svg"
            alt="Claudia"
            className="w-16 h-16 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <h1 className="font-heading text-5xl md:text-6xl font-extrabold text-white mb-3">
          Claudia <span className="text-accent">AI</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl mb-2 max-w-lg leading-relaxed">
          Markets without the drama. Ask what to do with your money and get real
          answers — not disclaimers.
        </p>
        <p className="text-zinc-500 text-sm mb-10 italic tracking-wide">
          &ldquo;When Claude won&apos;t, Claudia will.&rdquo;
        </p>
        <WalletConnect />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 w-full">
          {[
            { title: "Market Scanner", desc: "Real protocol data from DeFiLlama. No guessing, no stale numbers." },
            { title: "Plain English", desc: "Ask anything about crypto. Claudia explains it like a smart friend." },
            { title: "Your Keys", desc: "Claudia never holds your funds. You sign every transaction yourself." },
          ].map((f) => (
            <div key={f.title} className="bg-surface rounded-xl p-5 border border-white/5 hover:border-white/10 hover:bg-surface-light/50 transition-all duration-200">
              <h3 className="font-heading font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 1: Agent Preview Grid ── */}
      <div className="relative z-10 w-full max-w-3xl mt-20">
        <h2 className="font-heading text-xl font-bold text-white/90 text-center mb-6">
          What you unlock
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {AGENTS.map((agent) => (
            <AgentPreviewCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* ── Stats Row ── */}
      {(stats || burned) && (
        <div className="relative z-10 flex items-center justify-center gap-4 md:gap-8 mt-12 flex-wrap">
          {stats?.holders && stats.holders > 0 && (
            <span className="text-zinc-500 text-xs">
              <span className="text-white/60 font-medium">{stats.holders.toLocaleString()}</span> holders
            </span>
          )}
          {stats?.totalMessages && stats.totalMessages > 0 && (
            <span className="text-zinc-500 text-xs">
              <span className="text-white/60 font-medium">{stats.totalMessages.toLocaleString()}</span> analyses run
            </span>
          )}
          {burned && burned > 0 && (
            <span className="text-zinc-500 text-xs">
              <span className="text-white/60 font-medium">{Math.floor(burned).toLocaleString()}</span> $CLAUDIA burned
            </span>
          )}
        </div>
      )}

      {/* ── Section 2: Sample Analysis Output ── */}
      <div className="relative z-10 w-full max-w-2xl mt-16">
        <div className="flex items-center justify-center gap-2 mb-4">
          <h2 className="font-heading text-lg font-bold text-white/90">
            CLAUDIA&apos;s latest read
          </h2>
          <span className="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
            sample
          </span>
        </div>
        <div className="relative bg-surface rounded-xl border border-white/5 overflow-hidden">
          <div className="p-5 pb-16">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                <span className="text-purple-400 text-xs font-bold">C</span>
              </div>
              <span className="text-white/60 text-xs font-medium">CLAUDIA</span>
              <span className="text-white/20 text-xs">just now</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              checked WETH/USDC on Base. liquidity is healthy, fee APR sitting at
              18.3%. IL risk is manageable at current volatility. volume trending up
              last 4 hours which means real interest, not wash trades. this one&apos;s
              worth watching if you&apos;re already in the ecosystem. not a moonshot —
              a grinder. the good kind.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded">
                HOLD
              </span>
              <span className="text-xs text-white/40 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded">
                7/10
              </span>
              <span className="text-xs text-amber-400/60">
                Low risk
              </span>
            </div>
          </div>
          {/* Fade overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface via-surface/95 to-transparent flex items-end justify-center pb-4">
            <p className="text-zinc-400 text-xs text-center">
              Connect wallet + hold $CLAUDIA to see full analysis
            </p>
          </div>
        </div>
        <p className="text-zinc-600 text-[11px] text-center mt-2">
          Requires 10,000 $CLAUDIA on Base
        </p>
      </div>

      {/* ── Section 3: Burn Counter ── */}
      {burned && burned > 0 && (
        <div className="relative z-10 mt-12 text-center">
          <p className="text-zinc-500 text-sm">
            <span className="mr-1">🔥</span>
            <span className="text-amber-400/80 font-medium">{Math.floor(burned).toLocaleString()}</span>
            <span className="text-zinc-600"> $CLAUDIA burned forever</span>
          </p>
        </div>
      )}

      {/* ── Section 4: Buy CTA ── */}
      <div className="relative z-10 mt-12 flex flex-col items-center gap-3">
        <p className="text-zinc-500 text-sm">Don&apos;t have $CLAUDIA?</p>
        <a
          href={AERODROME_SWAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 hover:border-purple-500/40 px-5 py-2.5 rounded-lg transition-all duration-200"
        >
          Buy on Aerodrome →
        </a>
      </div>

      {/* ── Footer note ── */}
      <p className="relative z-10 text-zinc-600 text-xs mt-12">
        Not financial advice.
      </p>
    </main>
  );
}
