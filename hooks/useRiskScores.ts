"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Pool } from "./usePools";
import type { RiskLevel, RiskScore } from "@/lib/risk-scorer";

export type { RiskLevel, RiskScore };

interface UseRiskScoresResult {
  scores: Record<string, RiskScore>;
  isLoading: boolean;
  error: string | null;
}

const STALE_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Fetches batch risk scores for pools from the API.
 * Caches client-side for 30 minutes.
 */
export function useRiskScores(
  pools: Pool[],
  sessionToken: string | null | undefined
): UseRiskScoresResult {
  const [scores, setScores] = useState<Record<string, RiskScore>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const fetchedRef = useRef(false);

  const fetchScores = useCallback(async () => {
    if (!sessionToken || pools.length === 0) return;

    // Don't re-fetch within stale time
    if (Date.now() - lastFetchRef.current < STALE_TIME && fetchedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/claudia/risk-scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          pools: pools.slice(0, 30).map((p) => ({
            id: p.id,
            protocol: p.protocol,
            chain: p.chain,
            symbol: p.symbol,
            apy: p.apy,
            apyBase: p.apyBase,
            apyReward: p.apyReward,
            tvlUsd: p.tvlUsd,
            ilRisk: p.ilRisk,
            outlierApy: p.outlierApy,
            stablecoin: p.stablecoin,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch risk scores");
      }

      const data = await res.json();
      if (data.scores) {
        setScores(data.scores);
        lastFetchRef.current = Date.now();
        fetchedRef.current = true;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [pools, sessionToken]);

  // Fetch when pools are loaded and we have a token
  useEffect(() => {
    if (pools.length > 0 && sessionToken && !fetchedRef.current) {
      fetchScores();
    }
  }, [pools.length, sessionToken, fetchScores]);

  return { scores, isLoading, error };
}
