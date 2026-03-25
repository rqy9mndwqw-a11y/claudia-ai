"use client";

import { useState, useCallback, useMemo } from "react";
import type { Pool, ChainFilter, SortBy, RiskFilter, PoolsState } from "@/hooks/usePools";
import { useRiskScores } from "@/hooks/useRiskScores";
import { getProtocolMeta, getProtocolAge } from "@/lib/protocol-registry";
import PoolCard from "./PoolCard";
import ComparisonPanel from "./ComparisonPanel";
import DepositWizard from "./DepositWizard";
import ClaudiaCharacter from "./ClaudiaCharacter";
import Badge, { chainVariant, riskVariant } from "./ui/Badge";
import { useClaudiaMood } from "@/hooks/useClaudiaMood";
import { supportsDeposit } from "@/lib/defi-adapters";
import { PoolTableSkeleton } from "./ui/Skeleton";

interface PoolDashboardProps {
  poolsState: PoolsState;
  sessionToken?: string | null;
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M`;
  return `$${(tvl / 1_000).toFixed(0)}K`;
}

const CHAIN_OPTIONS: { value: ChainFilter; label: string }[] = [
  { value: "all", label: "All Chains" },
  { value: "Base", label: "Base" },
  { value: "Ethereum", label: "Ethereum" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "apy", label: "APY" },
  { value: "tvl", label: "TVL" },
  { value: "apyBase", label: "Base APY" },
];

export default function PoolDashboard({ poolsState, sessionToken }: PoolDashboardProps) {
  const { filteredPools, filters, setFilters, isLoading, error, refresh, isAnalyzing, setIsAnalyzing, hasHighApy, hasRiskyPools } = poolsState;
  const [analyzingPoolId, setAnalyzingPoolId] = useState<string | null>(null);
  const [claudiaMessage, setClaudiaMessage] = useState<string | undefined>(undefined);
  const [analyzedPool, setAnalyzedPool] = useState<Pool | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showComparison, setShowComparison] = useState(false);
  const [depositPool, setDepositPool] = useState<Pool | null>(null);

  // Risk scores
  const { scores: riskScores, isLoading: riskLoading } = useRiskScores(poolsState.pools, sessionToken);

  // Enrich pools with risk data + protocol metadata, then apply risk filter
  const enrichedPools = useMemo(() => {
    let result = filteredPools.map((pool) => {
      const score = riskScores[pool.id];
      const meta = getProtocolMeta(pool.protocol);
      const age = getProtocolAge(pool.protocol);
      return {
        ...pool,
        riskScore: score?.risk,
        riskReasoning: score?.reasoning,
        claudiaPick: score?.claudiaPick,
        protocolAge: age ?? undefined,
        audited: meta?.audited,
      };
    });

    // Risk level filter (runs here because riskScore/claudiaPick come from enrichment)
    if (filters.riskLevel === "picks") {
      result = result.filter((p) => p.claudiaPick);
    } else if (filters.riskLevel !== "all") {
      result = result.filter((p) => p.riskScore === filters.riskLevel);
    }

    return result;
  }, [filteredPools, riskScores, filters.riskLevel]);

  const claudiaMood = useClaudiaMood({
    walletConnected: true,
    loadingData: isLoading,
    pools: filteredPools.map((p) => ({
      apy: p.apy,
      tvlUsd: p.tvlUsd,
      riskFlags: p.outlierApy || p.ilRisk,
    })),
    aiResponding: isAnalyzing,
  });

  const handleAnalyze = useCallback(async (pool: Pool) => {
    if (!sessionToken) {
      setClaudiaMessage("Connect your wallet first.");
      return;
    }

    setAnalyzingPoolId(pool.id);
    setAnalyzedPool(pool);
    setIsAnalyzing(true);
    setClaudiaMessage("");

    try {
      const res = await fetch("/api/claudia/analyze-pool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ pool }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setClaudiaMessage(
          data?.error || "I had thoughts on this one but they didn't survive the trip. Try clicking again."
        );
        return;
      }

      setClaudiaMessage(data?.content || "Claudia had nothing to say. That's a first.");
    } catch {
      setClaudiaMessage("I had thoughts on this one but they didn't survive the trip. Try clicking again.");
    } finally {
      setIsAnalyzing(false);
      setAnalyzingPoolId(null);
    }
  }, [setIsAnalyzing, sessionToken]);

  // Summary stats (use enrichedPools which has risk filters applied)
  const displayPools = enrichedPools;
  const totalTvl = displayPools.reduce((sum, p) => sum + p.tvlUsd, 0);
  const highestApy = displayPools.length > 0 ? displayPools.reduce((max, p) => (p.apy > max.apy ? p : max), displayPools[0]) : null;

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5 text-center">
          <p className="text-zinc-400 mb-4 italic">&ldquo;{error}&rdquo;</p>
          <button
            onClick={refresh}
            className="bg-accent hover:bg-accent/80 text-white font-heading font-bold px-6 py-3 rounded-xl transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* CLAUDIA sidebar — left, matching chat page layout */}
      <div className="hidden lg:flex flex-col items-center w-52 border-r border-white/5 bg-surface/30 pt-6 flex-shrink-0">
        <ClaudiaCharacter
          imageSrc="/claudia-avatar.png"
          mood={claudiaMood}
          message={claudiaMessage}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Summary bar */}
        <div className="flex items-center gap-5 px-5 py-3 border-b border-white/5 bg-surface/20">
          <span className="text-zinc-500 text-xs">
            <span className="text-white font-bold text-sm">{displayPools.length}</span> pools
          </span>
          {highestApy && (
            <span className="text-zinc-500 text-xs">
              Top: <span className="text-accent font-bold text-sm">{highestApy.apy}%</span>{" "}
              <span className="text-zinc-400">{highestApy.protocol}</span>
            </span>
          )}
          <span className="text-zinc-500 text-xs">
            TVL: <span className="text-white font-bold text-sm">{formatTvl(totalTvl)}</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setShowComparison(true)}
              className="text-xs font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent
                         px-3 py-1.5 rounded-lg transition-all"
            >
              Compare Yields
            </button>
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
            {/* View Toggle */}
            <div className="flex items-center bg-surface-light rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list" ? "bg-accent text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="List View"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid" ? "bg-accent text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Grid View"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
            </div>

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Chain filter */}
            {CHAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ chain: opt.value })}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  filters.chain === opt.value
                    ? "bg-accent text-white"
                    : "bg-surface-light text-zinc-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Sort */}
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilters({ sortBy: opt.value })}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  filters.sortBy === opt.value
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
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Search protocol or token..."
              className="text-xs bg-surface border border-white/10 rounded-lg px-3 py-1.5
                         text-white placeholder-zinc-600 outline-none focus:border-accent/30
                         w-48 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick filter chips */}
            {[
              { key: "stablecoinsOnly" as const, label: "Stablecoins", active: filters.stablecoinsOnly },
              { key: "hideOutliers" as const, label: "Hide Outliers", active: filters.hideOutliers },
              { key: "hideIlRisk" as const, label: "Hide IL Risk", active: filters.hideIlRisk },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilters({ [chip.key]: !chip.active })}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  chip.active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {chip.label}
              </button>
            ))}

            {Object.keys(riskScores).length > 0 && (
              <>
                <div className="w-px h-4 bg-white/10 mx-1" />

                {/* Risk level filters */}
                {([
                  { value: "all" as RiskFilter, label: "All Risk" },
                  { value: "safe" as RiskFilter, label: "Safe" },
                  { value: "moderate" as RiskFilter, label: "Moderate" },
                  { value: "risky" as RiskFilter, label: "Risky" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilters({ riskLevel: opt.value })}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      filters.riskLevel === opt.value
                        ? opt.value === "safe" ? "border-green-500/40 bg-green-500/10 text-green-400"
                        : opt.value === "moderate" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                        : opt.value === "risky" ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : "border-accent/40 bg-accent/10 text-accent"
                        : "border-white/10 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}

                {/* Claudia's Picks */}
                <button
                  onClick={() => setFilters({ riskLevel: filters.riskLevel === "picks" ? "all" : "picks" })}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-bold ${
                    filters.riskLevel === "picks"
                      ? "border-accent/60 bg-accent/20 text-accent"
                      : "border-accent/20 text-accent/60 hover:text-accent"
                  }`}
                >
                  Claudia&apos;s Picks
                </button>
              </>
            )}

            {riskLoading && (
              <span className="text-[11px] text-zinc-600 italic ml-1">scoring pools...</span>
            )}
          </div>
        </div>

        {/* Claudia's response panel */}
        {(claudiaMessage || isAnalyzing) && (
          <div className="mx-5 mt-3 bg-surface rounded-xl border border-accent/20 overflow-hidden" role="status" aria-live="polite">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-accent/5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-accent animate-pulse" : "bg-accent"}`} />
                <span className="text-xs font-heading font-bold text-accent">Claudia&apos;s Take</span>
                {analyzedPool && (
                  <span className="text-xs text-zinc-500">
                    on <span className="text-zinc-300">{analyzedPool.protocol}</span>{" "}
                    <span className="text-zinc-400">{analyzedPool.symbol}</span>{" "}
                    <Badge variant={chainVariant(analyzedPool.chain)}>{analyzedPool.chain}</Badge>
                  </span>
                )}
              </div>
              {!isAnalyzing && (
                <button
                  onClick={() => { setClaudiaMessage(undefined); setAnalyzedPool(null); }}
                  className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
                >
                  dismiss
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              {isAnalyzing && !claudiaMessage ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border border-accent border-t-transparent" />
                  <span className="text-xs text-zinc-500 italic">thinking about this one...</span>
                </div>
              ) : (
                <p className="text-sm text-zinc-300 leading-relaxed">{claudiaMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Pool content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <PoolTableSkeleton />
          ) : displayPools.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-zinc-500 text-sm">No pools match your filters.</p>
            </div>
          ) : viewMode === "list" ? (
            /* ──── LIST VIEW ──── */
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-bg border-b border-white/5">
                <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                  <th className="pl-5 pr-2 py-2.5 font-semibold w-8">#</th>
                  <th className="px-2 py-2.5 font-semibold">Pool</th>
                  <th className="px-2 py-2.5 font-semibold">Chain</th>
                  <th className="px-2 py-2.5 text-right font-semibold">APY</th>
                  <th className="px-2 py-2.5 text-right font-semibold hidden sm:table-cell">Base</th>
                  <th className="px-2 py-2.5 text-right font-semibold hidden sm:table-cell">Reward</th>
                  <th className="px-2 py-2.5 text-right font-semibold">TVL</th>
                  <th className="px-2 py-2.5 font-semibold hidden md:table-cell">Tags</th>
                  <th className="pl-2 pr-5 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayPools.map((pool, i) => {
                  const isActive = analyzingPoolId === pool.id;
                  const riskBg = pool.riskScore === "trash" ? "border-l-red-500/60"
                    : pool.riskScore === "risky" ? "border-l-orange-500/50"
                    : pool.riskScore === "moderate" ? "border-l-yellow-500/50"
                    : pool.riskScore === "safe" ? "border-l-green-500/40"
                    : pool.outlierApy || pool.apy > 100 ? "border-l-red-500/60"
                    : pool.ilRisk || pool.apy >= 30 ? "border-l-yellow-500/50"
                    : "border-l-green-500/40";

                  return (
                    <tr
                      key={pool.id}
                      className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors border-l-2 ${riskBg} ${
                        isActive ? "bg-accent/5" : i % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
                      }`}
                    >
                      <td className="pl-5 pr-2 py-2.5 text-zinc-600 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <div className="min-w-0">
                          <span className="font-bold text-white text-sm">{pool.protocol}</span>
                          <div className="text-zinc-500 text-[11px] truncate max-w-[180px]">{pool.symbol}</div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant={chainVariant(pool.chain)}>{pool.chain}</Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span className={`font-heading font-bold text-sm tabular-nums ${
                          pool.apy >= 50 ? "text-accent" : pool.apy >= 15 ? "text-coral" : "text-white"
                        }`}>
                          {pool.apy.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-zinc-400 tabular-nums hidden sm:table-cell">
                        {pool.apyBase > 0 ? `${pool.apyBase.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums hidden sm:table-cell">
                        {pool.apyReward != null && pool.apyReward > 0 ? (
                          <span className="text-accent/70">{pool.apyReward.toFixed(1)}%</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-zinc-300 tabular-nums font-medium">
                        {formatTvl(pool.tvlUsd)}
                      </td>
                      <td className="px-2 py-2.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {pool.claudiaPick && <Badge variant="pick">PICK</Badge>}
                          {pool.riskScore && <Badge variant={riskVariant(pool.riskScore)}>{pool.riskScore.toUpperCase()}</Badge>}
                          {pool.audited && <Badge variant="tag-audit" title="Audited protocol">AUDIT</Badge>}
                          {pool.stablecoin && <Badge variant="tag-stable">STABLE</Badge>}
                          {pool.ilRisk && <Badge variant="tag-il">IL</Badge>}
                          {pool.outlierApy && <Badge variant="tag-outlier">OUTLIER</Badge>}
                        </div>
                      </td>
                      <td className="pl-2 pr-5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {supportsDeposit(pool.protocol) && (
                            <button
                              onClick={() => setDepositPool(pool)}
                              className="text-[11px] px-2.5 py-1 rounded-md transition-all font-medium
                                         bg-green-500/10 text-green-400 hover:bg-green-500/20"
                            >
                              Deposit
                            </button>
                          )}
                          <button
                            onClick={() => handleAnalyze(pool)}
                            disabled={isActive}
                            className={`text-[11px] px-2.5 py-1 rounded-md transition-all font-medium ${
                              isActive
                                ? "bg-accent/20 text-accent animate-pulse"
                                : "text-accent hover:bg-accent/15"
                            }`}
                          >
                            {isActive ? "..." : "Ask"}
                          </button>
                          <a
                            href={pool.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] px-2 py-1 text-zinc-600 hover:text-zinc-300 rounded-md transition-colors"
                          >
                            Open
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* ──── GRID VIEW ──── */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {displayPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  isAnalyzing={analyzingPoolId === pool.id}
                  onAnalyze={handleAnalyze}
                  onDeposit={setDepositPool}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison Panel (slide-over) */}
      {showComparison && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowComparison(false)}
          />
          <ComparisonPanel
            pools={displayPools}
            sessionToken={sessionToken}
            onClose={() => setShowComparison(false)}
          />
        </>
      )}

      {/* Deposit Wizard (modal) */}
      {depositPool && (
        <DepositWizard
          pool={depositPool}
          sessionToken={sessionToken}
          onClose={() => setDepositPool(null)}
        />
      )}
    </div>
  );
}
