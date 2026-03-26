"use client";

import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import PortfolioOverview from "@/components/PortfolioOverview";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useSessionToken } from "@/hooks/useSessionToken";

export default function PortfolioPage() {
  const { sessionToken, address } = useSessionToken();
  const portfolio = usePortfolio(address as `0x${string}` | undefined);

  return (
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="Portfolio Tracker">
        <PortfolioOverview
          positions={portfolio.positions}
          totalValue={portfolio.totalValue}
          isLoading={portfolio.isLoading}
          error={portfolio.error}
          refresh={portfolio.refresh}
          sessionToken={sessionToken}
        />
      </TokenGate>
    </main>
  );
}
