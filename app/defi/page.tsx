"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import PoolDashboard from "@/components/PoolDashboard";
import { usePools } from "@/hooks/usePools";
import { useSessionToken } from "@/hooks/useSessionToken";

export default function DefiPage() {
  const { sessionToken } = useSessionToken();
  const poolsState = usePools();

  return (
    <DashboardLayout>
      <TokenGate featureName="Yield Dashboard">
        <PoolDashboard poolsState={poolsState} sessionToken={sessionToken} />
      </TokenGate>
    </DashboardLayout>
  );
}
