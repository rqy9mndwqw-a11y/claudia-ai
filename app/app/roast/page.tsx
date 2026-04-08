"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "@/components/WalletConnect";
import ShareButtons from "@/components/roast/ShareButtons";
import {
  initMiniApp,
  isMiniApp,
  getFarcasterWalletAddress,
  promptAddMiniApp,
} from "@/lib/farcaster/miniapp";
import ConversionBanner from "@/components/farcaster/ConversionBanner";
import { useSessionToken } from "@/hooks/useSessionToken";

type RoastResult = {
  roastId: string;
  roast: string;
  score: number;
  verdict: string;
  qualityScore: number;
  totalValue: number;
  tokenCount: number;
  hasClaudia: boolean;
  walletShort: string;
  pnlTotal: number;
  txCount: number;
};

const TOXICITY_LEVELS = [
  {
    level: 1,
    name: "Friendly Roast",
    desc: "Light teasing. Your feelings might survive.",
    color: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-500/[0.06]",
    bgActive: "bg-green-500/[0.12]",
    gate: null,
  },
  {
    level: 2,
    name: "No Mercy",
    desc: "CLAUDIA stops holding back. Specific. Personal.",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.06]",
    bgActive: "bg-amber-500/[0.12]",
    gate: null,
  },
  {
    level: 3,
    name: "Maximum Toxicity",
    desc: "Full destruction. Your on-chain history weaponized.",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/[0.06]",
    bgActive: "bg-red-500/[0.12]",
    gate: "Hold 25,000 $CLAUDIA or any Signal NFT",
  },
];

export default function RoastPage() {
  const { address, isConnected } = useAccount();
  const { sessionToken } = useSessionToken();
  const [manualAddress, setManualAddress] = useState("");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toxicity, setToxicity] = useState(2);
  const [roastOther, setRoastOther] = useState(false);
  const [farcasterAddress, setFarcasterAddress] = useState<string | null>(null);
  const [inMiniApp, setInMiniApp] = useState(false);
  const [fcProfile, setFcProfile] = useState<{
    pfpUrl?: string;
    username?: string;
    displayName?: string;
  } | null>(null);

  useEffect(() => {
    // Dismiss Farcaster splash screen ASAP — must not wait for wallet
    initMiniApp();

    isMiniApp().then((isMini) => {
      if (!isMini) return;
      setInMiniApp(true);
      getFarcasterWalletAddress().then((addr) => {
        if (addr) setFarcasterAddress(addr);
      });
      // Pull Farcaster profile from SDK context
      import("@farcaster/miniapp-sdk").then((mod) => {
        const sdk = mod.default ?? mod;
        if (sdk?.context) {
          sdk.context.then((ctx: any) => {
            if (ctx?.user) {
              setFcProfile({
                pfpUrl: ctx.user.pfpUrl,
                username: ctx.user.username,
                displayName: ctx.user.displayName,
              });
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    });
  }, []);

  const hasWallet = inMiniApp ? !!farcasterAddress : isConnected;
  const connectedAddress = inMiniApp ? farcasterAddress : address;
  const targetAddress = (hasWallet && !roastOther) ? connectedAddress : manualAddress.trim();
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(targetAddress || "");

  async function handleRoast() {
    if (!targetAddress || !isValidAddress) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionToken && toxicity === 3) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }
      const res = await fetch("/api/roast", {
        method: "POST",
        headers,
        body: JSON.stringify({ address: targetAddress, toxicityLevel: toxicity }),
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
          backgroundImage: "linear-gradient(rgba(57,255,20,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(57,255,20,0.08)_0%,transparent_60%)]" />

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
          {hasWallet && !roastOther ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* Farcaster profile picture */}
                  {inMiniApp && fcProfile?.pfpUrl ? (
                    <img
                      src={fcProfile.pfpUrl}
                      alt=""
                      className="w-10 h-10 rounded-full border border-accent/30 flex-shrink-0"
                    />
                  ) : null}
                  <div>
                    <div className="text-[10px] font-mono text-accent/70 tracking-widest uppercase mb-0.5">
                      {inMiniApp ? "Victim Identified" : "Connected Wallet"}
                    </div>
                    {inMiniApp && fcProfile?.username ? (
                      <div className="text-white/90 text-sm font-medium">
                        {fcProfile.displayName || fcProfile.username}
                        <span className="text-zinc-500 font-mono text-xs ml-1.5">@{fcProfile.username}</span>
                      </div>
                    ) : null}
                    <div className="text-zinc-500 font-mono text-xs">
                      {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRoast}
                  disabled={loading}
                  className="bg-accent hover:bg-[#27c00e] disabled:opacity-50 disabled:cursor-not-allowed
                             text-white font-heading font-bold px-8 py-3 rounded-lg transition-all
                             shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)]"
                >
                  {loading ? "Roasting..." : "Roast Me"}
                </button>
              </div>
              <button
                onClick={() => setRoastOther(true)}
                className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
              >
                Roast someone else →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {roastOther && hasWallet && (
                <button
                  onClick={() => { setRoastOther(false); setManualAddress(""); }}
                  className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  ← Back to my wallet
                </button>
              )}
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
                  className="bg-accent hover:bg-[#27c00e] disabled:opacity-30 disabled:cursor-not-allowed
                             text-white font-heading font-bold px-8 py-3 rounded-lg transition-all
                             shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                >
                  {loading ? "Roasting..." : "Roast This Wallet"}
                </button>
                {!hasWallet && !inMiniApp && (
                  <>
                    <div className="text-zinc-600 text-xs">or</div>
                    <WalletConnect />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Toxicity Level Selector */}
        <div className="bg-surface border border-white/[0.06] rounded-xl p-5 mb-6">
          <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-3">
            Toxicity Level
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TOXICITY_LEVELS.map((t) => {
              // L3 is selectable — server validates and silently downgrades if not qualified
              const isSelected = toxicity === t.level;
              return (
                <button
                  key={t.level}
                  onClick={() => setToxicity(t.level)}
                  className={`relative text-left p-3 rounded-lg border transition-all cursor-pointer
                    ${isSelected
                      ? `${t.bgActive} ${t.border} ${t.color}`
                      : `${t.bg} border-white/[0.06] text-zinc-500 hover:border-white/[0.1]`
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono font-bold ${isSelected ? t.color : "text-zinc-600"}`}>
                      L{t.level}
                    </span>
                    <span className={`text-[11px] font-medium ${isSelected ? "text-white/80" : "text-zinc-500"}`}>
                      {t.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-600 leading-relaxed">
                    {t.desc}
                  </div>
                  {t.gate && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[9px] text-zinc-600 font-mono">{t.gate}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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

            {/* Share + Actions */}
            <div className="border-t border-white/[0.04] px-6 py-4 space-y-3">
              <ShareButtons
                roastText={result.roast}
                walletShort={result.walletShort}
                roastId={result.roastId}
                qualityScore={result.qualityScore}
                totalValue={result.totalValue}
                pnlTotal={result.pnlTotal}
                txCount={result.txCount}
              />
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-zinc-600">
                  roasted by CLAUDIA AI · claudia.wtf
                </div>
                <div className="flex items-center gap-2">
                  {inMiniApp && (
                    <button
                      onClick={() => promptAddMiniApp()}
                      className="text-[10px] font-mono text-purple-400 hover:text-purple-300 px-3 py-1.5
                                 border border-purple-500/20 hover:border-purple-500/30 rounded transition-colors cursor-pointer"
                    >
                      + Save CLAUDIA
                    </button>
                  )}
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
          </div>
        )}

        {/* CTA */}
        {result && (
          <div className="mt-6">
            {inMiniApp ? (
              <ConversionBanner hasClaudia={result.hasClaudia} />
            ) : !result.hasClaudia ? (
              <div className="bg-surface-light border border-accent/10 rounded-xl p-5 text-center">
                <p className="text-zinc-400 text-sm mb-3">
                  Want the full analysis instead of just the roast?
                </p>
                <div className="flex justify-center gap-3">
                  <a
                    href="https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-accent/20 hover:bg-accent/30 text-accent font-mono text-sm
                               px-5 py-2.5 rounded-lg border border-accent/30 transition-colors"
                  >
                    Buy $CLAUDIA
                  </a>
                  <a
                    href="https://app.claudia.wtf"
                    className="bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white font-mono text-sm
                               px-5 py-2.5 rounded-lg border border-white/[0.08] transition-colors"
                  >
                    Launch App →
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 space-y-2">
          <div className="flex justify-center gap-6 text-[11px] font-mono">
            <a href="https://app.claudia.wtf" className="text-zinc-600 hover:text-zinc-400 transition-colors">App</a>
            <a href="https://x.com/0xCLAUDIA_wtf" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-400 transition-colors">X</a>
            <a href="https://t.me/askclaudia" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-400 transition-colors">Telegram</a>
            <a href="https://claudia.wtf" className="text-zinc-600 hover:text-zinc-400 transition-colors">claudia.wtf</a>
          </div>
          <p className="text-zinc-700 text-[9px] font-mono">not financial advice. obviously.</p>
        </div>
      </div>
    </div>
  );
}
