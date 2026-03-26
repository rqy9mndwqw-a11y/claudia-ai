"use client";

import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import PoolDashboard from "@/components/PoolDashboard";
import { usePools } from "@/hooks/usePools";
import { useSessionToken } from "@/hooks/useSessionToken";

export default function DefiPage() {
  const { sessionToken } = useSessionToken();
  const poolsState = usePools();

  return (
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="DeFi Dashboard">
        <PoolDashboard poolsState={poolsState} sessionToken={sessionToken} />
      </TokenGate>
    </main>
  );
}
