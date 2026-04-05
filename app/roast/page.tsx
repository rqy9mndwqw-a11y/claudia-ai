"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";

type RoastResult = {
  roast: string;
  score: number;
  verdict: string;
  totalValue: number;
  tokenCount: number;
  hasClaudia: boolean;
};

export default function RoastPage() {
  const { address, isConnected } = useAccount();
  const [manualAddress, setManualAddress] = useState("");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const targetAddress = isConnected ? address : manualAddress.trim();
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(targetAddress || "");

  async function handleRoast() {
    if (!targetAddress || !isValidAddress) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error((data as any).error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as RoastResult;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-zinc-200 relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(232,41,91,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(232,41,91,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,41,91,0.08)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-5xl sm:text-6xl font-bold tracking-tight text-white mb-3">
            Roast My Wallet
          </h1>
          <p className="text-zinc-500 text-sm font-mono tracking-wide">
            CLAUDIA AI will destroy your portfolio. You asked for it.
          </p>
        </div>

        {/* Input section */}
        <div className="bg-surface border border-white/[0.06] rounded-xl p-6 mb-6">
          {isConnected ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">
                  Connected Wallet
                </div>
                <div className="text-white/80 font-mono text-sm">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              </div>
              <button
                onClick={handleRoast}
                disabled={loading}
                className="bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-heading font-bold px-8 py-3 rounded-lg transition-all
                           shadow-[0_0_20px_rgba(232,41,91,0.3)] hover:shadow-[0_0_30px_rgba(232,41,91,0.5)]"
              >
                {loading ? "Roasting..." : "Roast Me"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase block mb-2">
                  Paste any wallet address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-sm
                             font-mono text-white placeholder:text-zinc-600 outline-none
                             focus:border-accent/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleRoast}
                  disabled={loading || !isValidAddress}
                  className="bg-accent hover:bg-accent/80 disabled:opacity-30 disabled:cursor-not-allowed
                             text-white font-heading font-bold px-8 py-3 rounded-lg transition-all
                             shadow-[0_0_20px_rgba(232,41,91,0.3)]"
                >
                  {loading ? "Roasting..." : "Roast This Wallet"}
                </button>
                <div className="text-zinc-600 text-xs">or</div>
                <WalletConnect />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6
                          text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-surface border border-accent/20 rounded-xl p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent
                            rounded-full animate-spin mb-4" />
            <p className="text-zinc-400 text-sm font-mono animate-pulse">
              pulling your wallet data. this is going to hurt.
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="bg-surface border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Score header */}
            <div className="bg-accent/10 border-b border-accent/20 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
                  Degen Score
                </div>
                <div className="text-3xl font-heading font-bold text-accent">
                  {result.score}/10
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
                  Portfolio
                </div>
                <div className="text-lg font-mono text-white/80">
                  ${result.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] font-mono text-zinc-600">
                  {result.tokenCount} tokens {result.hasClaudia ? "· holds $CLAUDIA" : ""}
                </div>
              </div>
            </div>

            {/* Roast body */}
            <div className="px-6 py-5">
              <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {result.roast}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.04] px-6 py-4 flex items-center justify-between">
              <div className="text-[10px] font-mono text-zinc-600">
                roasted by CLAUDIA AI · claudia.wtf
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = `My wallet just got roasted by CLAUDIA AI\n\nDegen Score: ${result.score}/10\n"${result.verdict}"\n\nGet roasted: roast.claudia.wtf`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-[10px] font-mono text-zinc-500 hover:text-accent px-3 py-1.5
                             border border-white/[0.06] rounded transition-colors cursor-pointer"
                >
                  Copy
                </button>
                <button
                  onClick={handleRoast}
                  className="text-[10px] font-mono text-zinc-500 hover:text-accent px-3 py-1.5
                             border border-white/[0.06] rounded transition-colors cursor-pointer"
                >
                  Roast Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        {result && !result.hasClaudia && (
          <div className="mt-6 bg-surface-light border border-accent/10 rounded-xl p-5 text-center">
            <p className="text-zinc-400 text-sm mb-3">
              Want the full analysis instead of just the roast?
            </p>
            <a
              href="https://claudia.wtf"
              className="inline-block bg-accent/20 hover:bg-accent/30 text-accent font-mono text-sm
                         px-6 py-2.5 rounded-lg border border-accent/30 transition-colors"
            >
              Get $CLAUDIA · Unlock CLAUDIA AI
            </a>
          </div>
        )}

        {/* Footer branding */}
        <div className="text-center mt-12">
          <a href="https://claudia.wtf" className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors">
            claudia.wtf
          </a>
        </div>
      </div>
    </div>
  );
}
