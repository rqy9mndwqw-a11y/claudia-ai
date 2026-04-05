"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState, memo } from "react";
import WalletConnect from "@/components/WalletConnect";
import { useBurnedAmount } from "@/hooks/useBurnedAmount";
import { AGENT_ID_TO_INFO, AGENT_CATEGORY_COLOR } from "@/lib/marketplace/agent-routing";
import { AGENT_CREDIT_TIERS } from "@/lib/credits/agent-tiers";

const AERODROME_SWAP_URL =
  "https://aerodrome.finance/swap?from=0x4200000000000000000000000000000000000006&to=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

// Tailwind color classes keyed by category name
const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string; glow: string }> = {
  green:   { border: "border-l-green-500/60",   bg: "bg-green-500/[0.12]",   text: "text-green-400",   badge: "bg-green-500/15 text-green-400/80",     glow: "group-hover:shadow-[0_0_12px_rgba(34,197,94,0.08)]" },
  emerald: { border: "border-l-emerald-500/60", bg: "bg-emerald-500/[0.12]", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400/80", glow: "group-hover:shadow-[0_0_12px_rgba(52,211,153,0.08)]" },
  blue:    { border: "border-l-blue-400/60",    bg: "bg-blue-400/[0.12]",    text: "text-blue-400",    badge: "bg-blue-400/15 text-blue-400/80",       glow: "group-hover:shadow-[0_0_12px_rgba(96,165,250,0.08)]" },
  purple:  { border: "border-l-purple-400/60",  bg: "bg-purple-400/[0.12]",  text: "text-purple-400",  badge: "bg-purple-400/15 text-purple-400/80",   glow: "group-hover:shadow-[0_0_12px_rgba(192,132,252,0.08)]" },
  amber:   { border: "border-l-amber-400/60",   bg: "bg-amber-400/[0.12]",   text: "text-amber-400",   badge: "bg-amber-400/15 text-amber-400/80",     glow: "group-hover:shadow-[0_0_12px_rgba(251,191,36,0.08)]" },
  orange:  { border: "border-l-orange-400/60",  bg: "bg-orange-400/[0.12]",  text: "text-orange-400",  badge: "bg-orange-400/15 text-orange-400/80",   glow: "group-hover:shadow-[0_0_12px_rgba(251,146,60,0.08)]" },
  pink:    { border: "border-l-pink-400/60",    bg: "bg-pink-400/[0.12]",    text: "text-pink-400",    badge: "bg-pink-400/15 text-pink-400/80",       glow: "group-hover:shadow-[0_0_12px_rgba(244,114,182,0.08)]" },
  red:     { border: "border-l-red-400/60",     bg: "bg-red-400/[0.12]",     text: "text-red-400",     badge: "bg-red-400/15 text-red-400/80",         glow: "group-hover:shadow-[0_0_12px_rgba(248,113,113,0.08)]" },
  teal:    { border: "border-l-teal-400/60",    bg: "bg-teal-400/[0.12]",    text: "text-teal-400",    badge: "bg-teal-400/15 text-teal-400/80",       glow: "group-hover:shadow-[0_0_12px_rgba(45,212,191,0.08)]" },
  sky:     { border: "border-l-sky-400/60",     bg: "bg-sky-400/[0.12]",     text: "text-sky-400",     badge: "bg-sky-400/15 text-sky-400/80",         glow: "group-hover:shadow-[0_0_12px_rgba(56,189,248,0.08)]" },
  indigo:  { border: "border-l-indigo-400/60",  bg: "bg-indigo-400/[0.12]",  text: "text-indigo-400",  badge: "bg-indigo-400/15 text-indigo-400/80",   glow: "group-hover:shadow-[0_0_12px_rgba(129,140,248,0.08)]" },
};

const AGENTS = Object.entries(AGENT_ID_TO_INFO).map(([id, info]) => ({
  id,
  ...info,
  credits: AGENT_CREDIT_TIERS[id] ?? 1,
  category: AGENT_CATEGORY_COLOR[id] || "purple",
}));

// ── Agent Preview Card ──

const AgentPreviewCard = memo(function AgentPreviewCard({
  agent,
}: {
  agent: (typeof AGENTS)[number];
}) {
  const c = COLOR_MAP[agent.category] || COLOR_MAP.purple;

  return (
    <div className={`group relative bg-surface rounded-lg border border-white/[0.06] border-l-[3px] ${c.border} p-3.5 transition-all duration-300 hover:border-white/[0.1] ${c.glow}`}>
      <div className="flex items-start gap-2.5">
        {/* Icon circle */}
        <div className={`w-7 h-7 rounded-md ${c.bg} flex items-center justify-center shrink-0`}>
          <span className="text-sm">{agent.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white/85 text-[13px] font-medium group-hover:text-white transition-colors">
              {agent.name}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${c.badge}`}>
              {agent.credits}cr
            </span>
          </div>
          <p className="text-zinc-600 text-[11px] leading-relaxed group-hover:text-zinc-500 transition-colors">
            {agent.description}
          </p>
        </div>
        {/* Lock icon — consistent: top-right, 14px, 0.15 opacity */}
        <div className="shrink-0 text-white/[0.15] mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
    </div>
  );
});

// ── Stat Block ──

const StatBlock = memo(function StatBlock({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 md:px-6">
      <span
        className={`font-mono text-base md:text-lg font-semibold tabular-nums ${
          accent ? "text-accent" : "text-white/80"
        }`}
      >
        {value}
      </span>
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
    </div>
  );
});

// ── Main Page ──

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { burned } = useBurnedAmount();
  const [stats, setStats] = useState<{
    holders?: number;
    totalMessages?: number;
  } | null>(null);

  useEffect(() => {
    if (isConnected) {
      router.push("/chat");
    }
  }, [isConnected, router]);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? (r.json() as Promise<any>) : null))
      .then((d: any) => d && setStats({ holders: d.holders, totalMessages: d.totalMessages }))
      .catch(() => {});
  }, []);

  if (isConnected) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Redirecting...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pb-24">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,41,91,0.06)_0%,transparent_60%)] pointer-events-none" />

      {/* ── Hero ── */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl pt-[18vh]">
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

        {/* CTA with glow */}
        <div className="animate-pulse-glow rounded-xl">
          <WalletConnect showEmail />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 w-full">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/60">
                  <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" /><path d="M4 6h.01" />
                  <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" /><circle cx="12" cy="12" r="2" />
                  <path d="m13.41 10.59 5.66-5.66" />
                </svg>
              ),
              title: "Market Scanner",
              desc: "Real protocol data from DeFiLlama. No guessing, no stale numbers.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/60">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              ),
              title: "Plain English",
              desc: "Ask anything about crypto. Claudia explains it like a smart friend.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/60">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
              title: "Your Keys",
              desc: "Claudia never holds your funds. You sign every transaction yourself.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-surface rounded-xl p-5 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
            >
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-heading font-bold text-white text-[15px] mb-1.5">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats Row (Fix 1) ── */}
      {(stats || burned) && (
        <div className="relative z-10 mt-16 flex items-center justify-center">
          <div className="flex items-center divide-x divide-white/[0.06]">
            {stats?.totalMessages && stats.totalMessages > 0 && (
              <StatBlock value={stats.totalMessages.toLocaleString()} label="Analyses run" />
            )}
            {burned && burned > 0 && (
              <StatBlock value={Math.floor(burned).toLocaleString()} label="$CLAUDIA burned" accent />
            )}
            <StatBlock value="Base" label="Chain" />
          </div>
        </div>
      )}

      {/* ── Section Divider (Fix 3) ── */}
      <div className="relative z-10 w-full max-w-3xl mt-16 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
          <h2 className="font-heading text-lg font-bold text-white/80 tracking-tight shrink-0">
            What you unlock
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
        </div>
      </div>

      {/* ── Agent Preview Grid ── */}
      <div className="relative z-10 w-full max-w-3xl">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {AGENTS.map((agent) => (
            <AgentPreviewCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* ── Terminal Output: Sample Analysis (Fix 4 — smooth fade + centered CTA) ── */}
      <div className="relative z-10 w-full max-w-2xl mt-20">
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
          <h2 className="font-heading text-lg font-bold text-white/80 tracking-tight">
            CLAUDIA&apos;s latest read
          </h2>
          <span className="text-[9px] text-amber-400/60 bg-amber-500/[0.08] border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest font-mono">
            sample
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
        </div>

        <div className="relative bg-surface rounded-xl border border-white/[0.06] overflow-hidden">
          {/* Terminal chrome */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.04]">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            <span className="text-[10px] text-zinc-600 ml-2 font-mono">claudia-terminal</span>
          </div>

          <div className="p-5 pb-24">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                <span className="text-accent text-[10px] font-bold">C</span>
              </div>
              <span className="text-accent/80 text-xs font-mono font-medium">CLAUDIA</span>
              <span className="text-zinc-700 text-[10px] font-mono">2m ago</span>
            </div>

            <div className="font-mono text-[13px] leading-relaxed text-zinc-400 space-y-2">
              <p>
                <span className="text-accent/50">$</span>{" "}
                <span className="text-white/60">checked WETH/USDC on Base.</span> liquidity is healthy,
                fee APR sitting at{" "}
                <span className="text-green-400/80">18.3%</span>. IL risk is
                manageable at current volatility.
              </p>
              <p>
                volume trending up last 4 hours which means real interest, not
                wash trades. this one&apos;s worth watching if you&apos;re already
                in the ecosystem.
              </p>
              <p className="text-zinc-500">
                not a moonshot — a grinder. the good kind.
                <span className="inline-block w-2 h-4 bg-accent/60 ml-0.5 -mb-0.5 animate-cursor-blink" />
              </p>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[11px] font-mono text-green-400 bg-green-500/[0.08] border border-green-500/20 px-2 py-0.5 rounded">
                HOLD
              </span>
              <span className="text-[11px] font-mono text-white/30 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded">
                7/10
              </span>
              <span className="text-[11px] font-mono text-amber-400/50">
                Low risk
              </span>
            </div>
          </div>

          {/* Smooth fade overlay with centered CTA */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface from-20% via-surface/90 via-60% to-transparent flex items-end justify-center pb-6">
            <p className="text-zinc-400 text-xs font-mono text-center">
              connect wallet + hold{" "}
              <span className="text-accent/60">$CLAUDIA</span> to see full
              analysis
            </p>
          </div>
        </div>

        <p className="text-zinc-700 text-[10px] text-center mt-2.5 font-mono">
          requires 10,000 $CLAUDIA on Base
        </p>
      </div>

      {/* ── Buy CTA (Fix 2) ── */}
      <div className="relative z-10 mt-16 flex flex-col items-center gap-3">
        <p className="text-zinc-600 text-sm">Don&apos;t have $CLAUDIA?</p>
        <a
          href={AERODROME_SWAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group text-sm font-medium text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-accent/30 px-6 py-2.5 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(232,41,91,0.1)]"
        >
          Buy on Aerodrome
          <span className="inline-block ml-1.5 group-hover:translate-x-0.5 transition-transform">→</span>
        </a>
        <p className="text-zinc-700 text-[11px]">then come back and connect your wallet</p>
      </div>

      {/* ── Footer ── */}
      <p className="relative z-10 text-zinc-700 text-[10px] mt-16 font-mono tracking-wider">
        Not financial advice.
      </p>
    </main>
  );
}
