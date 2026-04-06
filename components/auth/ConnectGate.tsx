"use client";

import { useAccount } from "wagmi";
import { useSessionToken } from "@/hooks/useSessionToken";
import WalletConnect from "@/components/WalletConnect";
import type { ReactNode } from "react";

/**
 * Wraps protected pages. Shows a connect prompt instead of
 * spinning or redirecting when the user isn't authenticated.
 *
 * Use `requireToken` to also gate on $CLAUDIA balance (existing TokenGate handles this).
 * Default: just requires wallet connection + session.
 */
export default function ConnectGate({ children }: { children: ReactNode }) {
  const { isConnected } = useAccount();
  const { sessionState, authError, retry, isAuthenticating } = useSessionToken();

  // Connected + authenticated — show content
  if (isConnected && sessionState === "authenticated") {
    return <>{children}</>;
  }

  // Authenticating — brief spinner
  if (isConnected && (sessionState === "checking" || isAuthenticating)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-mono">Verifying session...</p>
      </div>
    );
  }

  // Auth error — show retry
  if (isConnected && sessionState === "error") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-surface border border-red-500/20 rounded-xl p-8 max-w-md text-center">
          <div className="text-2xl mb-4">⚠️</div>
          <h2 className="font-heading text-lg font-bold text-white mb-2">Session Error</h2>
          <p className="text-zinc-500 text-sm mb-4">{authError || "Failed to verify your wallet. Try again."}</p>
          <button
            onClick={retry}
            className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold px-6 py-2.5 rounded-lg transition-all text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not connected — show connect prompt
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
      <div className="bg-surface border border-white/[0.06] rounded-xl p-8 max-w-md text-center">
        <div className="text-3xl mb-4">🔒</div>
        <h2 className="font-heading text-xl font-bold text-white mb-2">Connect to continue</h2>
        <p className="text-zinc-500 text-sm mb-2">
          Connect your wallet or sign in with email to access CLAUDIA.
        </p>
        <p className="text-zinc-600 text-xs mb-6">
          First-time users get 10 free credits for 24 hours.
        </p>
        <WalletConnect showEmail />
      </div>
    </div>
  );
}
