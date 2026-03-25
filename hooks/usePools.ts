"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export type RiskLevel = "safe" | "moderate" | "risky" | "trash";

export interface Pool {
  id: string;
  protocol: string;
  chain: "Base" | "Ethereum";
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  rewardTokens: string[];
  ilRisk: boolean;
  outlierApy: boolean;
  stablecoin: boolean;
  url: string;
  // Enhanced fields (populated by useRiskScores)
  riskScore?: RiskLevel;
  riskReasoning?: string;
  protocolAge?: number;
  audited?: boolean;
  claudiaPick?: boolean;
}

export type ChainFilter = "all" | "Base" | "Ethereum";
export type SortBy = "apy" | "tvl" | "apyBase";

export type RiskFilter = "all" | "safe" | "moderate" | "risky" | "picks";

export interface PoolFilters {
  chain: ChainFilter;
  sortBy: SortBy;
  stablecoinsOnly: boolean;
  hideOutliers: boolean;
  hideIlRisk: boolean;
  search: string;
  riskLevel: RiskFilter;
}

export interface PoolsState {
  pools: Pool[];
  filteredPools: Pool[];
  filters: PoolFilters;
  setFilters: (update: Partial<PoolFilters>) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  // Mood hook inputs
  hasHighApy: boolean;
  hasRiskyPools: boolean;
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
}

const PROTOCOL_URLS: Record<string, string> = {
  "aave-v3": "https://app.aave.com",
  "aerodrome-v1": "https://aerodrome.finance",
  "aerodrome-v2": "https://aerodrome.finance",
  "compound-v3": "https://app.compound.finance",
  "uniswap-v3": "https://app.uniswap.org",
  "curve-dex": "https://curve.fi",
  "lido": "https://lido.fi",
  "rocket-pool": "https://rocketpool.net",
  "morpho": "https://app.morpho.org",
  "moonwell": "https://moonwell.fi",
  "extra-finance": "https://app.extrafi.io",
};

function getProtocolUrl(project: string): string {
  const key = project.toLowerCase().replace(/\s+/g, "-");
  return PROTOCOL_URLS[key] || `https://defillama.com/yields?project=${encodeURIComponent(project)}`;
}

export function usePools(): PoolsState {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filters, setFiltersState] = useState<PoolFilters>({
    chain: "all",
    sortBy: "apy",
    stablecoinsOnly: false,
    hideOutliers: true,
    hideIlRisk: false,
    search: "",
    riskLevel: "all",
  });

  const setFilters = useCallback((update: Partial<PoolFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
  }, []);

  const fetchPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("https://yields.llama.fi/pools");
      if (!res.ok) throw new Error("DeFiLlama is being dramatic. Try again in a minute.");
      const { data } = await res.json();

      const normalized: Pool[] = data
        .filter(
          (p: any) =>
            (p.chain === "Base" || p.chain === "Ethereum") &&
            p.tvlUsd > 100_000 &&
            typeof p.apy === "number" &&
            p.apy > 0
        )
        .map((p: any) => ({
          id: String(p.pool || ""),
          protocol: String(p.project || "unknown"),
          chain: p.chain as "Base" | "Ethereum",
          symbol: String(p.symbol || "unknown"),
          tvlUsd: Number(p.tvlUsd) || 0,
          apy: Math.round((Number(p.apy) || 0) * 100) / 100,
          apyBase: Math.round((Number(p.apyBase) || 0) * 100) / 100,
          apyReward: p.apyReward ? Math.round(Number(p.apyReward) * 100) / 100 : null,
          rewardTokens: Array.isArray(p.rewardTokens) ? p.rewardTokens.map(String) : [],
          ilRisk: p.ilRisk === "yes",
          outlierApy: Boolean(p.outlier),
          stablecoin: Boolean(p.stablecoin),
          url: getProtocolUrl(String(p.project || "")),
        }));

      setPools(normalized);
    } catch (err) {
      setError((err as Error).message || "Failed to fetch pools");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const filteredPools = useMemo(() => {
    let result = [...pools];

    // Chain filter
    if (filters.chain !== "all") {
      result = result.filter((p) => p.chain === filters.chain);
    }

    // Quick filters
    if (filters.stablecoinsOnly) {
      result = result.filter((p) => p.stablecoin);
    }
    if (filters.hideOutliers) {
      result = result.filter((p) => !p.outlierApy);
    }
    if (filters.hideIlRisk) {
      result = result.filter((p) => !p.ilRisk);
    }

    // Search
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.protocol.toLowerCase().includes(q) ||
          p.symbol.toLowerCase().includes(q)
      );
    }

    // NOTE: Risk level filtering is done in PoolDashboard on enrichedPools,
    // because riskScore and claudiaPick are added post-fetch by useRiskScores.

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "apy":
          return b.apy - a.apy;
        case "tvl":
          return b.tvlUsd - a.tvlUsd;
        case "apyBase":
          return b.apyBase - a.apyBase;
        default:
          return b.apy - a.apy;
      }
    });

    // Cap at 100 to keep the page responsive (~3K pools otherwise)
    return result.slice(0, 100);
  }, [pools, filters]);

  const hasHighApy = useMemo(() => filteredPools.some((p) => p.apy > 20), [filteredPools]);
  const hasRiskyPools = useMemo(
    () => filteredPools.some((p) => p.outlierApy || p.ilRisk),
    [filteredPools]
  );

  return {
    pools,
    filteredPools,
    filters,
    setFilters,
    isLoading,
    error,
    refresh: fetchPools,
    hasHighApy,
    hasRiskyPools,
    isAnalyzing,
    setIsAnalyzing,
  };
}
