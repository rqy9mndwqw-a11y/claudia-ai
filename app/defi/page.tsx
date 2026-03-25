"use client";

import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import PoolDashboard from "@/components/PoolDashboard";
import { usePools } from "@/hooks/usePools";

export default function DefiPage() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const poolsState = usePools();
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isConnected) {
        router.push("/");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isConnected, router]);

  // Auto-authenticate when wallet connects
  const authenticate = useCallback(async () => {
    if (!address || sessionToken) return;
    try {
      const nonceRes = await fetch("/api/session");
      const { message } = await nonceRes.json();
      const signature = await signMessageAsync({ message });
      const verifyRes = await fetch("/api/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
      });
      if (verifyRes.ok) {
        const { token } = await verifyRes.json();
        setSessionToken(token);
      }
    } catch {
      // Auth failed — pool analysis won't work but browsing still will
    }
  }, [address, sessionToken, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address && !sessionToken) {
      authenticate();
    }
  }, [isConnected, address, sessionToken, authenticate]);

  return (
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="DeFi Dashboard">
        <PoolDashboard poolsState={poolsState} sessionToken={sessionToken} />
      </TokenGate>
    </main>
  );
}
