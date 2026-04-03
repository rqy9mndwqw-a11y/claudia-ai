"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import AgentCard, { AgentRow } from "@/components/AgentCard";
import Skeleton from "@/components/ui/Skeleton";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useAgents } from "@/hooks/useAgents";
import { useCredits } from "@/hooks/useCredits";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "defi", label: "DeFi" },
  { value: "trading", label: "Trading" },
  { value: "research", label: "Research" },
  { value: "degen", label: "Degen" },
  { value: "general", label: "General" },
] as const;

const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "cheapest", label: "Cheapest" },
] as const;

function AgentGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface/50 rounded-xl border border-white/5 p-4 space-y-3" style={{ opacity: 1 - i * 0.1 }}>
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

const ONBOARDING_STEPS = [
  "Pick an agent based on what you need help with. I curated these myself.",
  "Click an example prompt or type your own question. Don't be boring.",
  "Credits are deducted per interaction. Check your balance anytime — I'm not running a charity.",
];

function OnboardingTooltip() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("hasSeenAgentGuide")) setVisible(true);
    } catch {}
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem("hasSeenAgentGuide", "1"); } catch {}
  };

  return (
    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mx-4 mt-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">💅</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold mb-1">Step {step + 1}/3</p>
          <p className="text-zinc-300 text-xs leading-relaxed">{ONBOARDING_STEPS[step]}</p>
          <div className="flex items-center gap-2 mt-3">
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)} className="text-xs font-bold text-accent hover:text-white transition-colors">
                Next &rarr;
              </button>
            ) : (
              <button onClick={dismiss} className="text-xs font-bold text-accent hover:text-white transition-colors">
                Got it
              </button>
            )}
            <button onClick={dismiss} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors ml-auto">
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between px-5 py-2 bg-accent/5 border-b border-accent/10">
      <p className="text-zinc-400 text-xs">
        <span className="mr-1.5">🧪</span>
        Agent Marketplace is in Beta — responses may vary. Full launch coming soon.
      </p>
      <button onClick={() => setDismissed(true)} className="text-zinc-600 hover:text-zinc-400 text-xs ml-4 flex-shrink-0">
        Dismiss
      </button>
    </div>
  );
}

function CommandCenter({ sessionToken, credits, creditsLoading }: { sessionToken: string | null; credits: number; creditsLoading: boolean }) {
  const [query, setQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const router = useRouter();
  const lowFuel = !creditsLoading && credits < 10;

  // Auto-fill from scanner swarm button (?q=BTC)
  useEffect(() => {
    if (autoTriggered) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setQuery(`Full analysis on ${q}`);
      setAutoTriggered(true);
    }
  }, [autoTriggered]);

  const handleSubmit = async () => {
    if (!query.trim() || !sessionToken || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/full-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ message: query.trim() }),
      });
      const data = await res.json() as any;
      if (data.analysisId) {
        router.push(`/analysis/${data.analysisId}`);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("Analysis failed. Try again.");
      }
    } catch {
      setError("Request timed out. Try a simpler query.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`mx-4 mt-4 rounded-2xl border p-5 transition-all ${
      lowFuel
        ? "bg-surface border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] animate-pulse"
        : "bg-surface border-accent/20 shadow-[0_0_20px_rgba(236,72,153,0.12)]"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent font-mono">Command Center</span>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] font-mono text-zinc-600">
          {credits.toLocaleString()} credits
        </span>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            placeholder={lowFuel
              ? "[LOW FUEL]: INSUFFICIENT CREDITS FOR ANALYSIS..."
              : "[SYSTEM INPUT]: ENTER TOKEN OR ASSET FOR MULTI-AGENT SWARM ANALYSIS..."
            }
            className={`w-full bg-bg border rounded-xl py-3.5 px-4 text-sm font-mono text-white placeholder-zinc-600 outline-none transition-all ${
              lowFuel
                ? "border-amber-500/30 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                : "border-white/10 focus:border-accent/30 focus:ring-2 focus:ring-accent/20"
            }`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !lowFuel && handleSubmit()}
            disabled={isAnalyzing || lowFuel}
          />
        </div>

        {lowFuel ? (
          <a
            href="/credits"
            className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-xs py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
            REFUEL NOW
          </a>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!query.trim() || isAnalyzing}
            className="flex-shrink-0 bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold font-mono text-xs py-3.5 px-6 rounded-xl shadow-lg shadow-accent/20 transition-all glow"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">&#9889;</span> ANALYZING...
              </span>
            ) : (
              "EXECUTE SWARM"
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[10px] font-mono text-red-400 mt-2">{error}</p>
      )}
      <p className="text-[10px] font-mono text-zinc-600 mt-2 text-right">
        {lowFuel
          ? "minimum 6 credits required for swarm analysis"
          : "6\u201310 credits per execution \u00b7 3\u20135 specialist agents deployed"
        }
      </p>
    </div>
  );
}

function MarketplaceContent({ sessionToken }: { sessionToken: string | null }) {
  const {
    agents, isLoading, error,
    category, setCategory,
    sortBy, setSortBy,
    search, setSearch,
    refresh,
  } = useAgents(sessionToken);
  const { credits, tier, isLoading: creditsLoading } = useCredits(sessionToken);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <OnboardingTooltip />
      <CommandCenter sessionToken={sessionToken} credits={credits} creditsLoading={creditsLoading} />
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 bg-surface/20">
        <div>
          <span className="text-zinc-500 text-xs">
            <span className="text-white font-bold text-sm">{agents.length}</span> agents
          </span>
          <span className="text-zinc-600 text-[11px] ml-3 hidden sm:inline">
            Specialized experts — deeper knowledge, specific tasks, unique personalities
          </span>
        </div>
        <span className="text-zinc-500 text-xs ml-auto sm:ml-0">
          Credits: <span className="text-accent font-bold text-sm">{credits.toLocaleString()}</span>
        </span>
        <div className="ml-auto flex items-center gap-3">
          {(tier === "create" || tier === "whale") && (
            <a
              href="/agents/create"
              className="text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent
                         px-3 py-1.5 rounded-lg transition-all"
            >
              Create Agent
            </a>
          )}
          <a
            href="/credits"
            className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500 hover:text-black px-3 py-1.5 rounded-lg transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            BUY CREDITS
          </a>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="text-xs text-zinc-500 hover:text-white transition-colors disabled:opacity-30"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-white/5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category tabs */}
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value as any)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                category === cat.value
                  ? "bg-accent text-white"
                  : "bg-surface-light text-zinc-400 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Sort */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value as any)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                sortBy === opt.value
                  ? "bg-surface-light text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex bg-surface-light rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-zinc-500"}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-zinc-500"}`}
            >
              List
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="text-xs bg-surface border border-white/10 rounded-lg px-3 py-1.5
                       text-white placeholder-zinc-600 outline-none focus:border-accent/30
                       w-full md:w-48 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="flex items-center justify-center py-20">
            <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5 text-center">
              <p className="text-zinc-400 mb-4">{error}</p>
              <button
                onClick={refresh}
                className="bg-accent hover:bg-accent/80 text-white font-heading font-bold px-6 py-3 rounded-xl transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {isLoading && !error ? (
          <AgentGridSkeleton />
        ) : agents.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-zinc-400 text-sm mb-1">No agents found.</p>
            <p className="text-zinc-600 text-xs">
              {tier === "create" || tier === "whale" ? (
                <a href="/agents/create" className="text-accent hover:underline">Create the first one?</a>
              ) : (
                `Hold ${(GATE_THRESHOLDS.marketplace_create / 1_000_000).toFixed(0)}M $CLAUDIA to create agents.`
              )}
            </p>
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {/* List header */}
                <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 border-b border-white/5">
                  <div className="w-0.5" />
                  <div className="flex-1">Agent</div>
                  <div className="w-20 text-center">Usage</div>
                  <div className="w-16 text-center">Rating</div>
                  <div className="w-16 text-center">Cost</div>
                </div>
                {agents.map((agent) => (
                  <AgentRow key={agent.id} agent={agent} />
                ))}
              </div>
            )}

            {/* Creator banner moved to sidebar Resources group */}
          </>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { sessionToken, sessionState, authError, retry } = useSessionToken();


  return (
    <DashboardLayout>
      <TokenGate minBalance={GATE_THRESHOLDS.marketplace_browse} featureName="Agent Marketplace">
        <ErrorBoundary>
          {sessionState === "error" && !sessionToken ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-zinc-400 text-sm mb-2">{authError || "Authentication failed"}</p>
              <button
                onClick={retry}
                className="bg-accent hover:bg-accent/80 text-white font-heading font-bold px-6 py-3 rounded-xl transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            <MarketplaceContent sessionToken={sessionToken} />
          )}
        </ErrorBoundary>
      </TokenGate>
    </DashboardLayout>
  );
}
