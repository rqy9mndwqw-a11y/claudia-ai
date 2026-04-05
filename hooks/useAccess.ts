"use client";

import { useState, useEffect } from "react";
import { useSessionToken } from "./useSessionToken";
import type { AccessLevel } from "@/lib/auth/access";

const PUBLIC_ACCESS: AccessLevel = {
  isPublic: true,
  isConnected: false,
  isTokenHolder: false,
  isNftHolder: false,
  isLegendary: false,
  canRoastFree: true,
  canRoastLevel3: false,
  canPredict: false,
  canSubmitRotd: false,
  canAccessApp: false,
  canUseAgents: false,
  canEnterArena: false,
  canVoteGovernance: false,
  canProposeGovernance: false,
  hasFreeCredits: false,
  freeCreditsRemaining: 0,
  rugDetectorLevel: 0,
  chartReaderLevel: 0,
  macroPulseLevel: 0,
  alphaHunterLevel: 0,
  ironHandsLevel: 0,
  claudiaBalance: 0,
  nftTokenIds: [],
  nftTiers: [],
};

export function useAccess() {
  const { sessionToken, isConnected } = useSessionToken();
  const [access, setAccess] = useState<AccessLevel>(PUBLIC_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) {
      setAccess(PUBLIC_ACCESS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch("/api/auth/access", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setAccess(d as AccessLevel);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionToken]);

  return { access, loading, isConnected };
}
