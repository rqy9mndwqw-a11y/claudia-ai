"use client";

import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import WalletConnect from "@/components/WalletConnect";
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
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-4">
          <span className="font-heading font-bold text-white text-lg">
            Claudia <span className="text-accent">AI</span>
          </span>
          <nav className="hidden md:flex gap-1">
            <a href="/chat" className="text-zinc-500 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Chat
            </a>
            <a href="/defi" className="text-white text-xs px-3 py-1.5 rounded-lg bg-surface-light transition-colors">
              DeFi
            </a>
            <a href="/trade" className="text-zinc-500 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Trade
            </a>
          </nav>
        </div>
        <WalletConnect />
      </header>
      <TokenGate featureName="DeFi Dashboard">
        <PoolDashboard poolsState={poolsState} sessionToken={sessionToken} />
      </TokenGate>
    </main>
  );
}
