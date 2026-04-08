"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";

const PrivyLoginButton = dynamic(() => import("./PrivyLoginButton"), { ssr: false });

export default function WalletConnect({ showEmail = false }: { showEmail?: boolean }) {
  const [inMiniApp, setInMiniApp] = useState(false);
  const [miniAppAddress, setMiniAppAddress] = useState<string | null>(null);
  const [miniAppConnecting, setMiniAppConnecting] = useState(false);

  useEffect(() => {
    import("@farcaster/miniapp-sdk").then((mod) => {
      const sdk = mod.default ?? mod;
      sdk.isInMiniApp().then((yes: boolean) => {
        if (yes) setInMiniApp(true);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const connectInMiniApp = useCallback(async () => {
    setMiniAppConnecting(true);
    try {
      const mod = await import("@farcaster/miniapp-sdk");
      const sdk = mod.default ?? mod;
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) throw new Error("No wallet provider");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const addr = accounts?.[0];
      if (addr) {
        setMiniAppAddress(addr);
        // Trigger SIWE auth via the session endpoint
        const nonceRes = await fetch("/api/session");
        if (!nonceRes.ok) throw new Error("Failed to get nonce");
        const { message } = (await nonceRes.json()) as any;

        const signature = await provider.request({
          method: "personal_sign",
          params: [message as `0x${string}`, addr as `0x${string}`],
        });

        const verifyRes = await fetch("/api/session/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr, signature, message }),
        });

        if (!verifyRes.ok) throw new Error("Verification failed");
        const data = (await verifyRes.json()) as any;
        // Store session token — must match useSessionToken format: { token, expiry }
        if (typeof window !== "undefined" && data.token) {
          localStorage.setItem(
            `claudia_session_${addr.toLowerCase()}`,
            JSON.stringify({ token: data.token, expiry: Date.now() + 24 * 60 * 60 * 1000 })
          );
          // Reload to pick up the session
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Mini App wallet connect failed:", err);
    } finally {
      setMiniAppConnecting(false);
    }
  }, []);

  // Mini App context — use SDK wallet directly
  if (inMiniApp) {
    if (miniAppAddress) {
      return (
        <div className="bg-surface-light hover:bg-surface-light/80 text-white font-body
                        px-4 py-2 rounded-lg border border-white/10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {miniAppAddress.slice(0, 6)}...{miniAppAddress.slice(-4)}
        </div>
      );
    }
    return (
      <button
        onClick={connectInMiniApp}
        disabled={miniAppConnecting}
        className="bg-accent hover:bg-[#27c00e] disabled:opacity-50 text-white font-heading font-bold
                   px-6 py-3 rounded-xl transition-all duration-200 glow"
      >
        {miniAppConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  // Standard wagmi flow
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={openConnectModal}
                      className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold
                                 px-6 py-3 rounded-xl transition-all duration-200 glow"
                    >
                      Connect Wallet
                    </button>
                    {showEmail && process.env.NEXT_PUBLIC_PRIVY_APP_ID && (
                      <PrivyLoginButton />
                    )}
                  </div>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="bg-red-600 hover:bg-red-700 text-white font-body font-medium
                               px-4 py-2 rounded-lg transition-colors"
                  >
                    Switch to Base
                  </button>
                );
              }

              return (
                <button
                  onClick={openAccountModal}
                  className="bg-surface-light hover:bg-surface-light/80 text-white font-body
                             px-4 py-2 rounded-lg border border-white/10 transition-colors
                             flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  {account.displayName}
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
