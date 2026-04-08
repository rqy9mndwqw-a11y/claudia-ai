"use client";

import { useState, useEffect, useCallback } from "react";

interface CreditBalance {
  credits: number;
  tier: string;
  total_spent: number;
  total_earned: number;
  transactions: Array<{
    id: number;
    amount: number;
    type: string;
    reference_id: string | null;
    balance_after: number;
    created_at: string;
  }>;
}

interface UseCreditsResult {
  credits: number;
  tier: string;
  totalSpent: number;
  totalEarned: number;
  transactions: CreditBalance["transactions"];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCredits(sessionToken: string | null): UseCreditsResult {
  const [data, setData] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null) as any;
        throw new Error(d?.error || "Failed to fetch credits");
      }

      setData(await res.json() as any);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    credits: data?.credits ?? 0,
    tier: data?.tier ?? "browse",
    totalSpent: data?.total_spent ?? 0,
    totalEarned: data?.total_earned ?? 0,
    transactions: data?.transactions ?? [],
    isLoading,
    error,
    refresh: fetchCredits,
  };
}
