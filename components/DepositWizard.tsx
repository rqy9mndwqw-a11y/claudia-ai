"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import type { Pool } from "@/hooks/usePools";
import { getDefiAdapter, type TxStep, type StepStatus } from "@/lib/defi-adapters";
import { AAVE_ATOKENS } from "@/lib/contracts";
import { parseUnits } from "viem";
import TxStepIndicator from "./TxStepIndicator";

interface DepositWizardProps {
  pool: Pool;
  sessionToken: string | null | undefined;
  onClose: () => void;
}

type WizardPhase = "preview" | "executing" | "done" | "error";

/** Resolve the underlying token address and decimals for an Aave pool */
function resolveAaveToken(pool: Pool): { address: `0x${string}`; decimals: number; symbol: string } | null {
  // Match pool symbol to known Aave tokens
  const symbolUpper = pool.symbol.toUpperCase();
  for (const [key, token] of Object.entries(AAVE_ATOKENS)) {
    if (symbolUpper.includes(key.toUpperCase())) {
      return { address: token.underlying, decimals: token.decimals, symbol: key };
    }
  }
  return null;
}

export default function DepositWizard({ pool, sessionToken, onClose }: DepositWizardProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<WizardPhase>("preview");
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claudiaBrief, setClaudiaBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const { sendTransactionAsync } = useSendTransaction();
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  const txReceipt = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  const adapter = getDefiAdapter(pool.protocol);
  const tokenInfo = resolveAaveToken(pool);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Fetch Claudia's brief on mount
  useEffect(() => {
    if (!sessionToken) return;
    setBriefLoading(true);
    fetch("/api/claudia/deposit-brief", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        protocol: pool.protocol,
        symbol: pool.symbol,
        apy: pool.apy,
        tvlUsd: pool.tvlUsd,
        ilRisk: pool.ilRisk,
        stablecoin: pool.stablecoin,
        riskScore: pool.riskScore,
      }),
    })
      .then((r) => r.json())
      .then((data) => setClaudiaBrief(data.content || null))
      .catch(() => {})
      .finally(() => setBriefLoading(false));
  }, [sessionToken, pool]);

  // Refs to avoid stale closures in the execution chain
  const stepsRef = useRef<TxStep[]>([]);
  const executingRef = useRef(false);

  const executeStep = useCallback(async (stepIndex: number) => {
    const step = stepsRef.current[stepIndex];
    if (!step || executingRef.current) return;
    executingRef.current = true;

    setStepStatuses((prev) => {
      const next = [...prev];
      next[stepIndex] = "active";
      return next;
    });

    try {
      const hash = await sendTransactionAsync({
        to: step.tx.to,
        data: step.tx.data,
        value: step.tx.value,
      });
      executingRef.current = false;
      setPendingTxHash(hash);
    } catch (err) {
      executingRef.current = false;
      setStepStatuses((prev) => {
        const next = [...prev];
        next[stepIndex] = "error";
        return next;
      });
      setErrorMessage((err as Error).message?.includes("rejected")
        ? "Transaction rejected in wallet."
        : "Transaction failed. Try again.");
      setPhase("error");
    }
  }, [sendTransactionAsync]);

  // Handle transaction receipt → advance to next step or finish
  useEffect(() => {
    if (!pendingTxHash) return;

    if (txReceipt.isSuccess) {
      setStepStatuses((prev) => {
        const next = [...prev];
        next[currentStepIndex] = "complete";
        return next;
      });

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < stepsRef.current.length) {
        setCurrentStepIndex(nextIndex);
        setPendingTxHash(undefined);
        executeStep(nextIndex);
      } else {
        setPhase("done");
        setPendingTxHash(undefined);
      }
    }

    if (txReceipt.isError) {
      setStepStatuses((prev) => {
        const next = [...prev];
        next[currentStepIndex] = "error";
        return next;
      });
      setErrorMessage("Transaction failed. Check your wallet for details.");
      setPhase("error");
      setPendingTxHash(undefined);
    }
  }, [txReceipt.isSuccess, txReceipt.isError, pendingTxHash, currentStepIndex, executeStep]);

  const handleDeposit = useCallback(async () => {
    if (!adapter || !address || !tokenInfo) return;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    try {
      const parsedAmount = parseUnits(amount, tokenInfo.decimals);

      const txSteps = await adapter.getDepositSteps({
        tokenAddress: tokenInfo.address,
        amount: parsedAmount,
        userAddress: address,
        decimals: tokenInfo.decimals,
      });

      stepsRef.current = txSteps;
      setSteps(txSteps);
      setStepStatuses(txSteps.map(() => "upcoming" as StepStatus));
      setCurrentStepIndex(0);
      setPhase("executing");
      executeStep(0);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to prepare deposit.");
      setPhase("error");
    }
  }, [adapter, address, tokenInfo, amount, executeStep]);

  if (!adapter) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
        <div className="bg-bg rounded-2xl border border-white/10 p-6 max-w-md w-full text-center">
          <p className="text-zinc-400 mb-4">Deposits aren&apos;t supported for {pool.protocol} yet.</p>
          <button onClick={onClose} className="text-accent hover:underline text-sm">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-bg rounded-2xl border border-white/10 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-heading font-bold text-white text-lg">
            Deposit into {pool.protocol}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Pool info */}
          <div className="flex items-center justify-between bg-surface/50 rounded-xl p-4 border border-white/5">
            <div>
              <p className="text-white font-bold">{pool.protocol}</p>
              <p className="text-zinc-500 text-xs">{pool.symbol} on {pool.chain}</p>
            </div>
            <div className="text-right">
              <p className="text-accent font-heading font-bold text-lg">{pool.apy.toFixed(1)}%</p>
              <p className="text-zinc-600 text-[11px] uppercase">APY</p>
            </div>
          </div>

          {/* Claudia's brief */}
          {(claudiaBrief || briefLoading) && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
              <p className="text-[11px] text-accent uppercase font-bold mb-1">Claudia says</p>
              {briefLoading ? (
                <p className="text-xs text-zinc-500 italic">thinking about this one...</p>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">{claudiaBrief}</p>
              )}
            </div>
          )}

          {phase === "preview" && (
            <>
              {/* Amount input */}
              {tokenInfo ? (
                <div>
                  <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
                    Amount ({tokenInfo.symbol})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`0.00 ${tokenInfo.symbol}`}
                    min="0"
                    step="any"
                    className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3
                               text-white text-sm outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  Couldn&apos;t identify the token for this pool.
                </p>
              )}

              {/* Risk warnings */}
              <div className="space-y-1">
                {pool.ilRisk && (
                  <p className="text-yellow-400 text-xs">This pool has impermanent loss risk.</p>
                )}
                {pool.riskScore === "risky" && (
                  <p className="text-orange-400 text-xs">Claudia rated this pool as risky.</p>
                )}
                {pool.riskScore === "trash" && (
                  <p className="text-red-400 text-xs">Claudia rated this pool as trash. Proceed with caution.</p>
                )}
              </div>

              {/* Deposit button */}
              <button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || !tokenInfo}
                className="w-full py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider
                           bg-accent hover:bg-accent/80 text-white transition-all
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Deposit
              </button>
            </>
          )}

          {(phase === "executing" || phase === "done" || phase === "error") && (
            <>
              <TxStepIndicator
                steps={steps.map((s, i) => ({
                  label: s.label,
                  description: s.description,
                  status: stepStatuses[i],
                }))}
              />

              {phase === "done" && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-bold">Deposit successful</p>
                  <p className="text-zinc-400 text-xs mt-1">
                    Your {tokenInfo?.symbol} is now earning yield on {pool.protocol}.
                  </p>
                </div>
              )}

              {phase === "error" && errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                  <button
                    onClick={() => {
                      setPhase("preview");
                      setErrorMessage(null);
                      setSteps([]);
                      setStepStatuses([]);
                    }}
                    className="text-accent hover:underline text-xs mt-2"
                  >
                    Try again
                  </button>
                </div>
              )}

              {phase === "done" && (
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-heading font-bold text-sm
                             bg-surface-light hover:bg-white/10 text-white transition-all"
                >
                  Close
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
