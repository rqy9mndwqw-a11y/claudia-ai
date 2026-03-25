"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import WalletConnect from "@/components/WalletConnect";
import TokenGate from "@/components/TokenGate";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
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
    <main className="h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-4">
          <span className="font-heading font-bold text-white text-lg">
            Claudia <span className="text-accent">AI</span>
          </span>
          <nav className="hidden md:flex gap-1">
            <a href="/chat" className="text-white text-xs px-3 py-1.5 rounded-lg bg-surface-light transition-colors">
              Chat
            </a>
            <a href="/defi" className="text-zinc-500 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              DeFi
            </a>
            <a href="/portfolio" className="text-zinc-500 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Portfolio
            </a>
            <a href="/trade" className="text-zinc-500 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Trade
            </a>
          </nav>
        </div>
        <WalletConnect />
      </header>
      <TokenGate>
        <ChatInterface />
      </TokenGate>
    </main>
  );
}
