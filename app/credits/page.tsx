"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import Badge from "@/components/ui/Badge";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useCredits } from "@/hooks/useCredits";
import { TIER_THRESHOLDS } from "@/lib/marketplace/types";

const CLAUDIA_TOKEN = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B" as `0x${string}`;
const USDC_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const CREDITS_CONTRACT = "0x34C2F4c5dcd5D62365673Bc6f44180efb8a81151" as `0x${string}`;

const ERC20_APPROVE_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
] as const;

const CREDITS_PURCHASE_CLAUDIA_ABI = [
  { name: "purchaseWithClaudia", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
] as const;

const CREDITS_PURCHASE_USDC_ABI = [
  { name: "purchaseWithUsdc", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }, { name: "minClaudiaOut", type: "uint256" }],
    outputs: [] },
] as const;

const CREDITS_QUOTE_ABI = [
  { name: "quoteUsdcPurchase", type: "function", stateMutability: "view",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "claudiaAmount", type: "uint256" }, { name: "credits", type: "uint256" }] },
] as const;

type PaymentMethod = "claudia" | "usdc";

// Clear, linear state machine — each step has exactly one UI representation
type Step = "idle" | "approving" | "purchasing" | "issuing" | "done" | "error";

function getStepLabels(method: PaymentMethod): Record<Step, string> {
  return {
    idle: method === "usdc" ? "Buy with USDC" : "Buy with $CLAUDIA",
    approving: "Approve in wallet...",
    purchasing: "Confirm purchase in wallet...",
    issuing: "Issuing credits...",
    done: "Buy More",
    error: "Try Again",
  };
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  browse: { label: "BROWSE", color: "text-zinc-400" },
  use: { label: "USE", color: "text-blue-400" },
  create: { label: "CREATE", color: "text-accent" },
  whale: { label: "WHALE", color: "text-accent" },
};

function StepIndicator({ step, method }: { step: Step; method: PaymentMethod }) {
  if (step === "idle") return null;

  const steps = [
    { key: "approving", label: method === "usdc" ? "Approve USDC" : "Approve $CLAUDIA" },
    { key: "purchasing", label: method === "usdc" ? "Swap USDC → CLAUDIA + burn" : "Purchase credits" },
    { key: "issuing", label: "Issue to account" },
  ];

  const stepOrder = ["approving", "purchasing", "issuing", "done"];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="bg-bg rounded-lg p-4 space-y-3">
      {steps.map((s, i) => {
        const isDone = currentIdx > i || step === "done";
        const isActive = currentIdx === i && step !== "done" && step !== "error";
        const isError = step === "error" && currentIdx === i;

        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              isDone ? "border-green-500 bg-green-500" :
              isError ? "border-red-500 bg-red-500/20" :
              isActive ? "border-accent bg-accent/20 animate-pulse" :
              "border-zinc-700"
            }`}>
              {isDone && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {isError && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${
              isDone ? "text-green-400" : isActive ? "text-white" : isError ? "text-red-400" : "text-zinc-600"
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Pending tx localStorage persistence ──

const PENDING_TX_KEY = "pending_credit_tx";

interface PendingTx {
  txHash: string;
  walletAddress: string;
  timestamp: number;
  amount: string;
}

function savePendingTx(tx: PendingTx): void {
  try {
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(tx));
  } catch {}
}

function loadPendingTx(walletAddress: string): PendingTx | null {
  try {
    const raw = localStorage.getItem(PENDING_TX_KEY);
    if (!raw) return null;
    const tx = JSON.parse(raw) as PendingTx;
    // Must match current wallet
    if (tx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) return null;
    // Expire after 24 hours
    if (Date.now() - tx.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_TX_KEY);
      return null;
    }
    return tx;
  } catch {
    return null;
  }
}

function clearPendingTx(): void {
  try {
    localStorage.removeItem(PENDING_TX_KEY);
  } catch {}
}

function PendingTxBanner({
  sessionToken,
  walletAddress,
  onResolved,
}: {
  sessionToken: string | null;
  walletAddress: string | undefined;
  onResolved: () => void;
}) {
  const [pending, setPending] = useState<PendingTx | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Check on mount
  useEffect(() => {
    if (!walletAddress) return;
    const tx = loadPendingTx(walletAddress);
    setPending(tx);
  }, [walletAddress]);

  if (!pending) return null;

  const timeAgo = (() => {
    const mins = Math.floor((Date.now() - pending.timestamp) / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  const shortHash = `${pending.txHash.slice(0, 10)}...${pending.txHash.slice(-6)}`;

  const handleRetry = async () => {
    if (!sessionToken) return;
    setRetrying(true);
    setRetryError(null);

    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ txHash: pending.txHash }),
      });

      if (res.ok || res.status === 409) {
        // 409 = already processed — credits were issued previously
        clearPendingTx();
        setPending(null);
        onResolved();
      } else {
        const data = await res.json().catch(() => null) as any;
        setRetryError(`${data?.error || "Retry failed"} (HTTP ${res.status})`);
      }
    } catch {
      setRetryError("Network error. Try again.");
    } finally {
      setRetrying(false);
    }
  };

  const handleDismiss = () => {
    clearPendingTx();
    setPending(null);
  };

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-yellow-400 text-lg flex-shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-yellow-400 text-sm font-bold">Pending credit purchase from {timeAgo}</p>
          <p className="text-zinc-400 text-xs mt-0.5">
            Transaction: <code className="text-zinc-300 font-mono">{shortHash}</code>
            {" · "}{Number(pending.amount).toLocaleString()} CLAUDIA
          </p>
          {retryError && (
            <p className="text-red-400 text-xs mt-1">{retryError}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 ml-8">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
            retrying
              ? "bg-yellow-500/20 text-yellow-400 animate-pulse cursor-wait"
              : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
          }`}
        >
          {retrying ? "Retrying..." : "Retry Now"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={retrying}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Read the session token fresh from localStorage.
 * More reliable than React closure state during long async flows
 * (MetaMask approval + purchase can take 30+ seconds).
 */
function getFreshSessionToken(walletAddress: string | undefined): string | null {
  if (!walletAddress) return null;
  try {
    const key = `claudia_session_${walletAddress.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiry) return null;
    return session.token;
  } catch {
    return null;
  }
}

function CreditsContent({ sessionToken, walletAddress }: { sessionToken: string | null; walletAddress: string | undefined }) {
  const { credits, tier, totalSpent, totalEarned, transactions, refresh } = useCredits(sessionToken);
  const [method, setMethod] = useState<PaymentMethod>("claudia");
  const [claudiaAmount, setClaudiaAmount] = useState("2000000");
  const [usdcAmount, setUsdcAmount] = useState("10");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [failedTxHash, setFailedTxHash] = useState<string | null>(null);

  // USDC quote state
  const [usdcQuote, setUsdcQuote] = useState<{ claudia: bigint; credits: bigint } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { writeContractAsync } = useWriteContract();

  const isProcessing = step !== "idle" && step !== "done" && step !== "error";

  // Debounced USDC quote fetch
  useEffect(() => {
    if (method !== "usdc") return;
    const numUsdc = Number(usdcAmount);
    if (!numUsdc || numUsdc < 10) {
      setUsdcQuote(null);
      return;
    }

    if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    setQuoteLoading(true);

    quoteTimeoutRef.current = setTimeout(async () => {
      try {
        const parsed = parseUnits(String(numUsdc), 6);
        // Call contract's quoteUsdcPurchase view function via RPC
        const res = await fetch("https://mainnet.base.org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{
              to: CREDITS_CONTRACT,
              // quoteUsdcPurchase(uint256) selector + encoded amount
              data: "0x" + "7c394fed" + parsed.toString(16).padStart(64, "0"),
            }, "latest"],
            id: 1,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const rpcData = await res.json() as any;
        if (rpcData.result && rpcData.result !== "0x" && rpcData.result.length >= 130) {
          // Decode two uint256 return values: claudiaAmount, credits
          const hex = rpcData.result.slice(2);
          const claudia = BigInt("0x" + hex.slice(0, 64));
          const creds = BigInt("0x" + hex.slice(64, 128));
          setUsdcQuote({ claudia, credits: creds });
        } else {
          setUsdcQuote(null);
        }
      } catch {
        setUsdcQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => { if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current); };
  }, [method, usdcAmount]);

  // ── Shared issue-credits-via-API logic ──
  async function issueCreditsFromTx(purchaseHash: string, token: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 3000));

    for (let attempt = 0; attempt < 3; attempt++) {
      const freshToken = getFreshSessionToken(walletAddress) || token;
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ txHash: purchaseHash }),
      });

      if (res.ok) return true;

      const data = await res.json().catch(() => null) as any;

      if (res.status === 425) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (res.status === 409) return true;

      setFailedTxHash(purchaseHash);
      throw new Error(data?.error || "Failed to issue credits");
    }
    return false;
  }

  // ── CLAUDIA purchase flow ──
  const handlePurchaseClaudia = useCallback(async () => {
    const token = getFreshSessionToken(walletAddress) || sessionToken;
    if (!token) { setErrorMsg("Session not ready. Please reconnect your wallet."); setStep("error"); return; }

    const num = Number(claudiaAmount);
    if (!num || num < 2_000_000) { setErrorMsg("Minimum: 2,000,000 CLAUDIA"); setStep("error"); return; }

    const parsed = parseUnits(String(num), 18);
    setFailedTxHash(null);

    try {
      setStep("approving");
      await writeContractAsync({ address: CLAUDIA_TOKEN, abi: ERC20_APPROVE_ABI, functionName: "approve", args: [CREDITS_CONTRACT, parsed] });

      setStep("purchasing");
      const hash = await writeContractAsync({ address: CREDITS_CONTRACT, abi: CREDITS_PURCHASE_CLAUDIA_ABI, functionName: "purchaseWithClaudia", args: [parsed] });

      if (walletAddress) savePendingTx({ txHash: hash, walletAddress, timestamp: Date.now(), amount: claudiaAmount });

      setStep("issuing");
      const issued = await issueCreditsFromTx(hash, token);
      if (!issued) { setFailedTxHash(hash); throw new Error("Credits not issued after 3 attempts. Save your tx hash."); }

      clearPendingTx();
      setStep("done");
      refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg.includes("rejected") || msg.includes("denied") ? "Transaction rejected. Try again." : msg);
      setStep("error");
    }
  }, [claudiaAmount, sessionToken, walletAddress, writeContractAsync, refresh]);

  // ── USDC purchase flow ──
  const handlePurchaseUsdc = useCallback(async () => {
    const token = getFreshSessionToken(walletAddress) || sessionToken;
    if (!token) { setErrorMsg("Session not ready. Please reconnect your wallet."); setStep("error"); return; }

    const num = Number(usdcAmount);
    if (!num || num < 10) { setErrorMsg("Minimum: 10 USDC"); setStep("error"); return; }
    if (!usdcQuote) { setErrorMsg("No quote available. Wait for quote to load."); setStep("error"); return; }

    const parsedUsdc = parseUnits(String(num), 6);
    // 2% slippage tolerance on the quoted amount
    const minClaudiaOut = (usdcQuote.claudia * 98n) / 100n;
    setFailedTxHash(null);

    try {
      // Approve USDC (not CLAUDIA) for the credits contract
      setStep("approving");
      await writeContractAsync({ address: USDC_TOKEN, abi: ERC20_APPROVE_ABI, functionName: "approve", args: [CREDITS_CONTRACT, parsedUsdc] });

      // Purchase: swap USDC → CLAUDIA → burn/treasury
      setStep("purchasing");
      const hash = await writeContractAsync({ address: CREDITS_CONTRACT, abi: CREDITS_PURCHASE_USDC_ABI, functionName: "purchaseWithUsdc", args: [parsedUsdc, minClaudiaOut] });

      if (walletAddress) savePendingTx({ txHash: hash, walletAddress, timestamp: Date.now(), amount: usdcAmount });

      setStep("issuing");
      const issued = await issueCreditsFromTx(hash, token);
      if (!issued) { setFailedTxHash(hash); throw new Error("Credits not issued after 3 attempts. Save your tx hash."); }

      clearPendingTx();
      setStep("done");
      refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg.includes("rejected") || msg.includes("denied") ? "Transaction rejected. Try again." : msg);
      setStep("error");
    }
  }, [usdcAmount, usdcQuote, sessionToken, walletAddress, writeContractAsync, refresh]);

  const handlePurchase = method === "usdc" ? handlePurchaseUsdc : handlePurchaseClaudia;

  const handleReset = () => {
    setStep("idle");
    setErrorMsg("");
    setFailedTxHash(null);
  };

  const estimatedCredits = method === "usdc"
    ? (usdcQuote ? Number(usdcQuote.credits) : 0)
    : Math.floor(Number(claudiaAmount) || 0);

  const stepLabels = getStepLabels(method);
  const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.browse;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">

        {/* Pending purchase recovery banner */}
        <PendingTxBanner
          sessionToken={sessionToken}
          walletAddress={walletAddress}
          onResolved={refresh}
        />

        {/* Balance card */}
        <div className="bg-surface rounded-xl border border-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Credit Balance</p>
              <p className="text-white font-heading font-bold text-4xl mt-1">{credits.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Tier</p>
              <p className={`font-heading font-bold text-lg ${tierInfo.color}`}>{tierInfo.label}</p>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-zinc-500">
            <span>Spent: <span className="text-white">{totalSpent.toLocaleString()}</span></span>
            <span>Earned: <span className="text-green-400">{totalEarned.toLocaleString()}</span></span>
          </div>

          {/* Tier thresholds */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
              {Object.entries(TIER_THRESHOLDS).map(([t, threshold]) => (
                <span key={t} className={tier === t ? "text-accent font-bold" : ""}>
                  {t.toUpperCase()} ({(threshold / 1000).toFixed(0)}K)
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Purchase section */}
        <div className="bg-surface rounded-xl border border-white/5 p-6">
          <h2 className="font-heading font-bold text-white text-lg mb-4">Buy Credits</h2>

          <div className="space-y-4">
            {/* Payment method toggle */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
                Pay with
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => { if (!isProcessing) setMethod("claudia"); }}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors font-bold ${
                    method === "claudia" ? "bg-accent text-white" : "bg-surface-light text-zinc-400 hover:text-white"
                  }`}
                >
                  $CLAUDIA
                </button>
                <button
                  onClick={() => { if (!isProcessing) setMethod("usdc"); }}
                  className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors font-bold ${
                    method === "usdc" ? "bg-accent text-white" : "bg-surface-light text-zinc-400 hover:text-white"
                  }`}
                >
                  USDC
                </button>
              </div>
            </div>

            {/* Amount input — differs by payment method */}
            {method === "claudia" ? (
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
                  Amount ($CLAUDIA)
                </label>
                <input
                  type="number"
                  value={claudiaAmount}
                  onChange={(e) => setClaudiaAmount(e.target.value)}
                  min="2000000"
                  step="1000000"
                  disabled={isProcessing}
                  className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3
                             text-white text-sm outline-none focus:border-accent/40 transition-colors
                             disabled:opacity-50"
                />
                <p className="text-[11px] text-zinc-600 mt-1">
                  Min: 2,000,000 CLAUDIA. You&apos;ll get ~{estimatedCredits.toLocaleString()} credits. 50% burned, 50% to treasury.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    value={usdcAmount}
                    onChange={(e) => setUsdcAmount(e.target.value)}
                    min="10"
                    step="1"
                    disabled={isProcessing}
                    className="w-full bg-bg border border-white/10 rounded-lg pl-7 pr-4 py-3
                               text-white text-sm outline-none focus:border-accent/40 transition-colors
                               disabled:opacity-50"
                  />
                </div>

                {/* USDC quote */}
                <div className="mt-2 bg-bg rounded-lg p-3 border border-white/5">
                  {quoteLoading ? (
                    <p className="text-[11px] text-zinc-500 italic">Fetching quote...</p>
                  ) : usdcQuote ? (
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-400">
                        ≈ <span className="text-white font-bold">{Number(formatUnits(usdcQuote.claudia, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> CLAUDIA
                        {" → "}<span className="text-accent font-bold">{Number(usdcQuote.credits).toLocaleString()}</span> credits
                      </p>
                      <p className="text-[11px] text-zinc-600">2% max slippage applied</p>
                    </div>
                  ) : Number(usdcAmount) >= 10 ? (
                    <p className="text-[11px] text-zinc-500">Unable to get quote</p>
                  ) : (
                    <p className="text-[11px] text-zinc-600">Min: $10 USDC</p>
                  )}
                </div>

                <p className="text-[11px] text-zinc-600 mt-1.5">
                  USDC is swapped to $CLAUDIA via Aerodrome. 50% burned, 50% to treasury. Credits based on swap output.
                </p>
              </div>
            )}

            <StepIndicator step={step} method={method} />

            {step === "error" && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
                <p className="text-red-400 text-sm">{errorMsg}</p>
                {failedTxHash && (
                  <div className="bg-bg rounded-lg p-2">
                    <p className="text-[11px] text-zinc-500 mb-1">Save this tx hash if your credits weren&apos;t issued:</p>
                    <code className="text-[11px] text-zinc-300 font-mono break-all">{failedTxHash}</code>
                  </div>
                )}
              </div>
            )}

            {step === "done" && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                <p className="text-green-400 font-bold">Credits purchased successfully</p>
              </div>
            )}

            <button
              onClick={step === "done" || step === "error" ? handleReset : handlePurchase}
              disabled={isProcessing || (!sessionToken && step === "idle") || (method === "usdc" && !usdcQuote && step === "idle")}
              className={`w-full py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider transition-all ${
                isProcessing
                  ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                  : step === "done"
                  ? "bg-surface-light hover:bg-white/10 text-white"
                  : step === "error"
                  ? "bg-surface-light hover:bg-white/10 text-white"
                  : "bg-accent hover:bg-accent/80 text-white disabled:opacity-30"
              }`}
            >
              {stepLabels[step]}
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-surface rounded-xl border border-white/5 p-6">
          <h2 className="font-heading font-bold text-white text-lg mb-4">Recent Transactions</h2>

          {transactions.length === 0 ? (
            <p className="text-zinc-600 text-sm">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={tx.amount > 0 ? "tag-stable" : "tag-il"} size="sm">
                      {tx.type.toUpperCase().replace("_", " ")}
                    </Badge>
                    <span className="text-zinc-600 text-[11px]">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const { sessionToken, address } = useSessionToken();

  return (
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="Credits">
        <ErrorBoundary>
          <CreditsContent sessionToken={sessionToken} walletAddress={address} />
        </ErrorBoundary>
      </TokenGate>
    </main>
  );
}
