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
        <span className="font-heading font-bold text-white text-lg">
          Claudia <span className="text-accent">AI</span>
        </span>
        <WalletConnect />
      </header>
      <TokenGate>
        <ChatInterface />
      </TokenGate>
    </main>
  );
}
