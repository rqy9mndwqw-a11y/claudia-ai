"use client";

import { useState, useEffect, useRef } from "react";

export type ClaudiaMood = "idle" | "impatient" | "thinking" | "excited" | "skeptical" | "talking";

interface DashboardState {
  walletConnected: boolean;
  loadingData: boolean;
  pools?: { apy: number; tvlUsd: number; riskFlags?: boolean }[];
  aiResponding: boolean;
}

export function useClaudiaMood(state: DashboardState): ClaudiaMood {
  const [mood, setMood] = useState<ClaudiaMood>("idle");
  const impatientCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const excitedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPoolsRef = useRef<typeof state.pools>(undefined);

  useEffect(() => {
    // Cleanup previous timers
    if (impatientCycleRef.current) {
      clearInterval(impatientCycleRef.current);
      impatientCycleRef.current = null;
    }
    if (excitedTimeoutRef.current) {
      clearTimeout(excitedTimeoutRef.current);
      excitedTimeoutRef.current = null;
    }

    // Priority 1: AI is responding → talking
    if (state.aiResponding) {
      setMood("talking");
      return;
    }

    // Priority 2: Loading data → thinking
    if (state.walletConnected && state.loadingData) {
      setMood("thinking");
      return;
    }

    // Priority 3: No wallet → impatient (cycles with idle every 10s)
    if (!state.walletConnected) {
      setMood("impatient");
      impatientCycleRef.current = setInterval(() => {
        setMood((prev) => (prev === "impatient" ? "idle" : "impatient"));
      }, 10000);
      return;
    }

    // Priority 4: Check pools for excitement or skepticism
    if (state.pools && state.pools.length > 0) {
      const hasHighApy = state.pools.some((p) => p.apy > 20);
      const hasRiskFlags = state.pools.some((p) => p.riskFlags || p.tvlUsd < 100_000);

      // Only trigger excited if we just discovered a high APY pool (not on every render)
      const prevHadHighApy = prevPoolsRef.current?.some((p) => p.apy > 20);
      if (hasHighApy && !prevHadHighApy) {
        setMood("excited");
        // One-shot: revert to idle after animation completes (3 iterations × 0.8s)
        excitedTimeoutRef.current = setTimeout(() => {
          setMood("idle");
        }, 2500);
        prevPoolsRef.current = state.pools;
        return;
      }

      if (hasRiskFlags) {
        setMood("skeptical");
        prevPoolsRef.current = state.pools;
        return;
      }
    }

    prevPoolsRef.current = state.pools;

    // Default: idle
    setMood("idle");

    return () => {
      if (impatientCycleRef.current) clearInterval(impatientCycleRef.current);
      if (excitedTimeoutRef.current) clearTimeout(excitedTimeoutRef.current);
    };
  }, [state.walletConnected, state.loadingData, state.aiResponding, state.pools]);

  return mood;
}
