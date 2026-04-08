"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAllPositions, type Position } from "@/lib/protocol-adapters";

export type { Position };

interface UsePortfolioResult {
  positions: Position[];
  totalValue: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const POLL_INTERVAL = 60_000; // 60 seconds

/**
 * Fetches all DeFi positions for a wallet address using protocol adapters.
 * Polls every 60s for updates.
 */
export function usePortfolio(address: `0x${string}` | undefined): UsePortfolioResult {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getAllPositions(address);
      setPositions(result);
    } catch (err) {
      setError((err as Error).message || "Failed to fetch positions");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Initial fetch
  useEffect(() => {
    if (address) {
      fetchPositions();
    } else {
      setPositions([]);
    }
  }, [address, fetchPositions]);

  // Polling
  useEffect(() => {
    if (!address) return;

    intervalRef.current = setInterval(fetchPositions, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [address, fetchPositions]);

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

  return {
    positions,
    totalValue,
    isLoading,
    error,
    refresh: fetchPositions,
  };
}
