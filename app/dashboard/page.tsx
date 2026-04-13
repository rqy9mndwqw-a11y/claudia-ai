"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ConnectGate from "@/components/auth/ConnectGate";
import { useSessionToken } from "@/hooks/useSessionToken";
import { emitPaymentFromHeaders } from "@/components/PaymentToastProvider";

type FeedPost = {
  id: string;
  post_type: string;
  agent_job: string;
  title: string;
  content: string;
  full_content?: string;
  verdict?: string;
  score?: number;
  risk?: string;
  token_symbol?: string;
  created_at: number;
};

type DashboardStats = {
  totalValue?: number;
  change24h?: number;
  burnedToday?: number;
  credits?: number;
};

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { sessionToken } = useSessionToken();
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [stats, setStats] = useState<DashboardStats>({});
  const [feedLoading, setFeedLoading] = useState(true);
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);

  const runFullAnalysis = async (symbol: string) => {
    if (!sessionToken || analyzingSymbol) return;
    setAnalyzingSymbol(symbol);
    try {
      const res = await fetch("/api/agents/full-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ message: `Full analysis on ${symbol}` }),
      });
      if (res.ok) emitPaymentFromHeaders(res, "Full analysis");
      const data = (await res.json()) as any;
      if (data.analysisId) router.push(`/analysis/${data.analysisId}`);
    } catch {}
    finally { setAnalyzingSymbol(null); }
  };

  // Fetch feed — public API, no auth needed
  useEffect(() => {
    fetch("/api/feed?limit=5")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d?.posts) setFeed(d.posts);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, []);

  // Fetch user credits
  useEffect(() => {
    if (!sessionToken) return;
    fetch("/api/credits", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d?.credits !== undefined) {
          setStats((s) => ({ ...s, credits: d.credits }));
        }
      })
      .catch(() => {});
  }, [sessionToken]);

  // Fetch burned amount
  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d) {
          setStats((s) => ({ ...s, burnedToday: d.burnedToday }));
        }
      })
      .catch(() => {});
  }, []);

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  function verdictColor(verdict?: string) {
    if (verdict === "Buy") return "text-green-400 bg-green-500/[0.08] border-green-500/20";
    if (verdict === "Avoid") return "text-red-400 bg-red-500/[0.08] border-red-500/20";
    return "text-amber-400 bg-amber-500/[0.08] border-amber-500/20";
  }

  function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  }

  return (
    <DashboardLayout>
      <ConnectGate>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header row */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-white mb-1">
            Welcome back, <span className="text-accent">{shortAddr}</span>
          </h1>
          <p className="text-zinc-600 text-sm font-mono">claudia.wtf dashboard</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Credits", value: stats.credits?.toLocaleString() ?? "—", accent: true },
            { label: "$CLAUDIA Burned Today", value: stats.burnedToday?.toLocaleString() ?? "—" },
            { label: "Chain", value: "Base" },
            { label: "Session", value: sessionToken ? "Active" : "—" },
          ].map((s) => (
            <div key={s.label} className="bg-surface rounded-lg border border-white/[0.06] p-4">
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">{s.label}</div>
              <div className={`font-heading text-lg font-bold ${s.accent ? "text-accent" : "text-white/80"}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Signal Feed */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-heading text-base font-bold text-white/80">Signal Feed</h2>
            <span className="text-[9px] font-mono text-zinc-600">Latest from CLAUDIA</span>
          </div>

          {feedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-lg border border-white/[0.06] p-4 animate-pulse">
                  <div className="h-4 bg-surface-light rounded w-1/3 mb-2" />
                  <div className="h-3 bg-surface-light rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : feed.length > 0 ? (
            <div className="space-y-3">
              {feed.map((post) => (
                <div
                  key={post.id}
                  className="bg-surface rounded-lg border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors cursor-pointer"
                  onClick={() => router.push("/scanner")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">
                      {post.agent_job === "full_analysis" ? "📊" : post.agent_job === "scanner" ? "🎯" : "📡"}
                    </span>
                    <span className="text-white/80 text-sm font-medium">{post.title}</span>
                    <span className="text-[10px] font-mono text-zinc-600 ml-auto">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-zinc-500 text-[13px] leading-relaxed mb-2 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-2">
                    {post.verdict && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${verdictColor(post.verdict)}`}>
                        {post.verdict}
                      </span>
                    )}
                    {post.score && (
                      <span className="text-[10px] font-mono text-white/30 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded">
                        {post.score}/10
                      </span>
                    )}
                    {post.risk && (
                      <span className="text-[10px] font-mono text-zinc-600">{post.risk} risk</span>
                    )}
                    {(() => {
                      let symbol = post.token_symbol;
                      if (!symbol && post.full_content) {
                        try {
                          const fc = JSON.parse(post.full_content);
                          symbol = fc.topPicks?.[0]?.symbol?.replace("/USD", "") || null;
                        } catch {}
                      }
                      if (!symbol && post.content) {
                        const m = post.content.match(/\b([A-Z]{2,6})\b/);
                        if (m) symbol = m[1];
                      }
                      return symbol ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            runFullAnalysis(symbol);
                          }}
                          disabled={analyzingSymbol === symbol}
                          className="ml-auto text-[10px] font-mono text-accent hover:text-white bg-accent/10 hover:bg-accent/20
                                     border border-accent/20 px-2.5 py-0.5 rounded transition-colors disabled:opacity-50"
                        >
                          {analyzingSymbol === symbol ? "Analyzing..." : `Analyze ${symbol} →`}
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-lg border border-white/[0.06] p-6 text-center">
              <p className="text-zinc-600 text-sm">No signals yet. Run an analysis to get started.</p>
            </div>
          )}
        </div>

        {/* Bot Performance Card */}
        <div className="mb-8">
          <div
            className="bg-surface rounded-xl border border-blue-500/20 p-5 flex items-center justify-between cursor-pointer hover:border-blue-500/30 transition-colors"
            onClick={() => router.push("/bot/performance")}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🤖</span>
                <span className="font-heading text-sm font-bold text-white/80">Paper Trading Live</span>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <p className="text-zinc-600 text-xs">Bot is running on Railway. See how it&apos;s doing.</p>
            </div>
            <span className="text-zinc-500 text-xs font-mono hover:text-white transition-colors">
              View Performance →
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="font-heading text-base font-bold text-white/80 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Run Full Analysis", href: "/scanner", icon: "📊" },
              { label: "Bot Performance", href: "/bot/performance", icon: "🤖" },
              { label: "Roast My Wallet", href: "/roast", icon: "🔥" },
              { label: "Browse Yield Scout", href: "/defi", icon: "💰" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="bg-surface hover:bg-surface-light rounded-lg border border-white/[0.06] hover:border-white/[0.1]
                           p-4 text-left transition-all duration-200 cursor-pointer group"
              >
                <div className="text-xl mb-2">{action.icon}</div>
                <div className="text-white/70 group-hover:text-white text-xs font-medium transition-colors">
                  {action.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Signal Pit Bottom Strip */}
        <div className="bg-surface rounded-xl border border-purple-500/20 p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">⚔️</span>
              <span className="font-heading text-sm font-bold text-white/80">Signal Pit — Season 01 Coming Soon</span>
            </div>
            <p className="text-zinc-600 text-xs">Mint your Signal NFT to reserve your spot.</p>
          </div>
          <div className="flex gap-2">
            <button
              disabled
              className="text-[10px] font-mono text-purple-400/50 bg-purple-500/10 border border-purple-500/20
                         px-4 py-2 rounded cursor-not-allowed"
            >
              Mint NFT
            </button>
            <button
              onClick={() => router.push("/arena")}
              className="text-[10px] font-mono text-zinc-500 hover:text-white bg-white/[0.03] border border-white/[0.06]
                         px-4 py-2 rounded transition-colors cursor-pointer"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
      </ConnectGate>
    </DashboardLayout>
  );
}
