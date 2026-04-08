"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import TradeInterface from "@/components/TradeInterface";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";

export default function TradePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isConnected) {
        router.push("/");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isConnected, router]);

  return (
    <DashboardLayout>
      <TokenGate minBalance={GATE_THRESHOLDS.trading} featureName="Claudia Trading Bot">
        <TradeInterface />
      </TokenGate>
    </DashboardLayout>
  );
}
