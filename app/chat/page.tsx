"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppHeader from "@/components/ui/AppHeader";
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
      <AppHeader />
      <TokenGate>
        <ChatInterface />
      </TokenGate>
    </main>
  );
}
