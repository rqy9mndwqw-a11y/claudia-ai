"use client";

import { WagmiProvider, useReconnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { PrivyProvider } from "@privy-io/react-auth";
import { wagmiConfig } from "@/lib/wagmi";
import { privyConfig } from "@/lib/web3/privy-config";
import { ToastProvider } from "./ui/Toast";
import { PaymentToastProvider } from "./PaymentToastProvider";
import { useState, useEffect } from "react";

function ReconnectHandler({ children }: { children: React.ReactNode }) {
  const { reconnect } = useReconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Re-establish wallet connection after mobile deep link returns
    reconnect();
  }, [reconnect]);

  return mounted ? <>{children}</> : null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const content = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#39ff14",
            accentColorForeground: "white",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          <ToastProvider>
            <PaymentToastProvider>
              <ReconnectHandler>
                {children}
              </ReconnectHandler>
            </PaymentToastProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );

  // Wrap with Privy if app ID is configured, otherwise run without it
  if (privyAppId) {
    return (
      <PrivyProvider appId={privyAppId} config={privyConfig}>
        {content}
      </PrivyProvider>
    );
  }

  return content;
}
