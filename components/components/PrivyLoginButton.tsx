"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect } from "react";

/**
 * "Continue with Email" button that uses Privy for email-based wallet creation.
 * After login, Privy creates an embedded wallet which the user can use
 * like any other wallet for token gating, credits, and sessions.
 */
export default function PrivyLoginButton() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();

  // When Privy authenticates with an embedded wallet, prompt wagmi connection
  useEffect(() => {
    if (!authenticated || !user) return;

    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    if (embeddedWallet) {
      // The embedded wallet address is available — the user can now
      // connect it via RainbowKit or use it directly for SIWE auth
      console.log("Privy embedded wallet:", embeddedWallet.address);
    }
  }, [authenticated, user, wallets]);

  if (!ready) return null;

  // Already authenticated via Privy — show the embedded wallet address
  if (authenticated && user) {
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    if (embeddedWallet) {
      return (
        <div className="flex items-center gap-2 bg-surface-light px-4 py-2 rounded-lg border border-white/10">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white/80 font-mono text-sm">
            {embeddedWallet.address.slice(0, 6)}...{embeddedWallet.address.slice(-4)}
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">(email)</span>
        </div>
      );
    }
  }

  return (
    <button
      onClick={() => login()}
      className="bg-surface-light hover:bg-surface-light/80 text-white/70 hover:text-white
                 font-body text-sm px-5 py-2.5 rounded-lg border border-white/10
                 transition-all duration-200 flex items-center gap-2"
    >
      <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
      Continue with Email
    </button>
  );
}
