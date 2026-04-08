"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";
import ConnectGate from "@/components/auth/ConnectGate";
import TokenGate from "@/components/TokenGate";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
  return (
    <DashboardLayout>
      <ConnectGate>
        <TokenGate>
          <ChatInterface />
        </TokenGate>
      </ConnectGate>
    </DashboardLayout>
  );
}
