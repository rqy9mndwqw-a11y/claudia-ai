"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentPublic } from "@/lib/marketplace/types";

type Category = "all" | "defi" | "trading" | "research" | "degen" | "general";
type SortBy = "popular" | "newest" | "cheapest";

interface UseAgentsResult {
  agents: AgentPublic[];
  isLoading: boolean;
  error: string | null;
  category: Category;
  setCategory: (c: Category) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  search: string;
  setSearch: (s: string) => void;
  refresh: () => void;
}

export function useAgents(sessionToken: string | null): UseAgentsResult {
  const [agents, setAgents] = useState<AgentPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [search, setSearch] = useState("");
  const [fetchKey, setFetchKey] = useState(0); // increment to force re-fetch

  // Core fetch — runs on mount, token change, filter change, or manual refresh
  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let active = true;

    setIsLoading(true);
    setError(null);

    const doFetch = async () => {
      try {
        const params = new URLSearchParams();
        if (category !== "all") params.set("category", category);
        if (search) params.set("search", search);
        params.set("limit", "100");

        const res = await fetch(`/api/agents?${params}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null) as any;
          throw new Error(data?.error || `Failed to load agents (${res.status})`);
        }

        const data = await res.json() as any;
        const sorted = (data.agents || []) as AgentPublic[];

        switch (sortBy) {
          case "popular":
            sorted.sort((a, b) => b.usage_count - a.usage_count);
            break;
          case "newest":
            sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;
          case "cheapest":
            sorted.sort((a, b) => a.cost_per_chat - b.cost_per_chat);
            break;
        }

        if (active) setAgents(sorted);
      } catch (err) {
        if (active) {
          setError((err as Error).message);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    doFetch();

    return () => { active = false; };
  }, [sessionToken, category, search, sortBy, fetchKey]);

  const refresh = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {
    agents, isLoading, error,
    category, setCategory,
    sortBy, setSortBy,
    search, setSearch,
    refresh,
  };
}
