"use client";

import { useState } from "react";
import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import AgentCard from "@/components/AgentCard";
import Skeleton from "@/components/ui/Skeleton";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useAgents } from "@/hooks/useAgents";
import { useCredits } from "@/hooks/useCredits";

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

function MarketplaceContent({ sessionToken }: { sessionToken: string | null }) {
  const {
    agents, isLoading, error,
    category, setCategory,
    sortBy, setSortBy,
    search, setSearch,
    refresh,
  } = useAgents(sessionToken);
  const { credits, tier } = useCredits(sessionToken);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            Buy Credits
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

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="text-xs bg-surface border border-white/10 rounded-lg px-3 py-1.5
                       text-white placeholder-zinc-600 outline-none focus:border-accent/30
                       w-48 transition-colors"
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
                "Hold 500K $CLAUDIA to create agents."
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>

            {/* Become a Creator banner — shown to non-creators */}
            {tier !== "create" && tier !== "whale" && (
              <div className="mx-4 mb-6 bg-accent/5 border border-accent/20 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-heading font-bold text-white text-sm mb-1">Become a Creator</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      Hold 500K $CLAUDIA to create AI agents. Earn 80% of credits when people use them.
                      Your agents run 24/7 and earn while you sleep.
                    </p>
                    <a href="/agents/guide" className="text-[11px] text-accent/70 hover:text-accent mt-2 inline-block transition-colors">
                      Read the creator guide &rarr;
                    </a>
                  </div>
                  <a
                    href="/credits"
                    className="text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent
                               px-4 py-2 rounded-lg transition-all flex-shrink-0"
                  >
                    Get $CLAUDIA
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { sessionToken } = useSessionToken();

  return (
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="Agent Marketplace">
        <ErrorBoundary>
          <MarketplaceContent sessionToken={sessionToken} />
        </ErrorBoundary>
      </TokenGate>
    </main>
  );
}
