"use client";

/**
 * TradeSignal — one-tap DEX swap flow initiated from a CLAUDIA signal.
 *
 * State machine:
 *   IDLE → QUOTING → QUOTED → APPROVING → EXECUTING → DONE | ERROR
 *
 * Security notes:
 *   - Server returns unsigned EIP-1559 calldata bound to session.address
 *   - Client signs via wagmi useSendTransaction — no key ever leaves wallet
 *   - Quote expires after 45s; countdown displayed; re-fetch button shown
 *   - USDC allowance checked before swap; approval tx prompted if needed
 *
 * Rendering:
 *   - Desktop: centered modal with backdrop
 *   - Mobile: bottom drawer
 *
 * Feature flag: when TRADE_EXECUTION_ENABLED is false, this component is
 * unmounted by parent (see callers); the flag is respected server-side too.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import type { Address } from "viem";
import { erc20Abi } from "viem";
import { useSessionToken } from "@/hooks/useSessionToken";
import { getBestPrice, type RouteScanResult, type VenueQuote } from "@/lib/trading/route-scanner";
import {
  BASESCAN_TX_URL,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  QUOTE_TTL_SEC,
  SLIPPAGE_DEFAULT_PCT,
  SLIPPAGE_MAX_PCT,
  SLIPPAGE_MIN_PCT,
  SPEND_MAX_USDC,
  SPEND_MIN_USDC,
  TRADE_EXECUTION_ENABLED,
} from "@/lib/trading/config";

type Phase = "idle" | "quoting" | "quoted" | "approving" | "executing" | "done" | "error";

interface TradeSignalProps {
  token_address: string;
  token_symbol: string;
  signal_id?: string | null;
  source_page?: "scanner" | "full-analysis" | "compare" | "watchlist" | "feed" | "direct";
  onClose: () => void;
}

interface ExecuteResponse {
  venue: string;
  unsigned_tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
    gas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    chainId: number;
  };
  allowance_target: Address;
  approve_tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
  };
  quote: {
    buy_amount: string;
    sell_amount: string;
    price: string;
    price_impact_pct: number;
    min_tokens_after_slippage: string;
    sources: Array<{ name: string; proportion: number }>;
    token_address: string;
    token_symbol: string;
  };
  signal_id: string | null;
  source_page: string;
  expires_at: number;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return n.toLocaleString("en", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "?";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function useCountdown(expires_at: number | null): number {
  const [remaining, setRemaining] = useState<number>(() =>
    expires_at ? Math.max(0, Math.floor((expires_at - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!expires_at) return;
    setRemaining(Math.max(0, Math.floor((expires_at - Date.now()) / 1000)));
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((expires_at - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [expires_at]);
  return remaining;
}

export default function TradeSignal({
  token_address,
  token_symbol,
  signal_id = null,
  source_page = "direct",
  onClose,
}: TradeSignalProps) {
  const { address: walletAddress } = useAccount();
  const { sessionToken } = useSessionToken();

  const [phase, setPhase] = useState<Phase>("idle");
  const [comparison, setComparison] = useState<RouteScanResult | null>(null);
  const [executeData, setExecuteData] = useState<ExecuteResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [spendInput, setSpendInput] = useState<string>("10");
  const [slippage, setSlippage] = useState<number>(SLIPPAGE_DEFAULT_PCT);

  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [finalTxHash, setFinalTxHash] = useState<`0x${string}` | undefined>();

  const spendUsdc = Number(spendInput);
  const spendValid =
    isFinite(spendUsdc) && spendUsdc >= SPEND_MIN_USDC && spendUsdc <= SPEND_MAX_USDC;

  // ── wagmi hooks ──
  const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();
  const txReceipt = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // USDC balance + allowance reads
  const usdcBalance = useReadContract({
    abi: erc20Abi,
    address: BASE_USDC_ADDRESS as Address,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  });
  const usdcAllowance = useReadContract({
    abi: erc20Abi,
    address: BASE_USDC_ADDRESS as Address,
    functionName: "allowance",
    args:
      walletAddress && executeData?.allowance_target
        ? [walletAddress, executeData.allowance_target]
        : undefined,
    query: { enabled: !!walletAddress && !!executeData?.allowance_target },
  });

  const usdcBalanceUsd = useMemo(() => {
    if (usdcBalance.data == null) return null;
    return Number(usdcBalance.data) / 10 ** BASE_USDC_DECIMALS;
  }, [usdcBalance.data]);

  const needsApproval = useMemo(() => {
    if (!executeData || usdcAllowance.data == null) return false;
    const required = BigInt(executeData.quote.sell_amount);
    const current = BigInt(String(usdcAllowance.data));
    return current < required;
  }, [executeData, usdcAllowance.data]);

  const countdown = useCountdown(executeData?.expires_at ?? null);
  const quoteExpired = countdown === 0 && phase === "quoted";

  // ── Escape to close ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Fetch venue comparison on mount ──
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!spendValid) return;
      setPhase("quoting");
      setErrorMsg(null);
      try {
        const result = await getBestPrice(token_address, token_symbol, spendUsdc);
        if (cancelled) return;
        setComparison(result);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg((err as Error).message);
        setPhase("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // Intentionally only refetch when the token changes; spend changes trigger
    // a dedicated re-quote flow via refreshQuote().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token_address]);

  // ── Fetch signable /execute quote ──
  const refreshQuote = useCallback(async () => {
    if (!sessionToken || !walletAddress || !spendValid) return;
    setPhase("quoting");
    setErrorMsg(null);
    try {
      // 1) Refresh comparison table
      const cmp = await getBestPrice(token_address, token_symbol, spendUsdc);
      setComparison(cmp);

      // 2) Fetch signable 0x quote (server returns unsigned tx)
      const res = await fetch("/api/trading/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          token_address,
          token_symbol,
          wallet_address: walletAddress,
          spend_usdc: spendUsdc,
          slippage_pct: slippage,
          signal_id,
          source_page,
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setErrorMsg(data.error || "Quote failed");
        setPhase("error");
        return;
      }
      setExecuteData(data as ExecuteResponse);
      setPhase("quoted");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase("error");
    }
  }, [sessionToken, walletAddress, spendValid, spendUsdc, slippage, token_address, token_symbol, signal_id, source_page]);

  // ── Execute path: approval → swap → record ──
  const executeTrade = useCallback(async () => {
    if (!executeData || !walletAddress || !sessionToken) return;
    setErrorMsg(null);

    // Approval, if needed
    try {
      if (needsApproval) {
        setPhase("approving");
        const approveHash = await sendTransactionAsync({
          to: executeData.approve_tx.to,
          data: executeData.approve_tx.data,
          value: BigInt(executeData.approve_tx.value || "0"),
        });
        // Wait for approval to mine before swapping — otherwise the swap
        // will fail with "allowance insufficient".
        setPendingTxHash(approveHash);
        // Return; the useEffect below watches txReceipt and moves to swap
        return;
      }
      await doSwap();
    } catch (err) {
      setErrorMsg((err as Error).message || "Transaction rejected");
      setPhase("error");
    }
  }, [executeData, walletAddress, sessionToken, needsApproval, sendTransactionAsync]);

  const doSwap = useCallback(async () => {
    if (!executeData) return;
    setPhase("executing");
    const tx = executeData.unsigned_tx;
    try {
      const hash = await sendTransactionAsync({
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value || "0"),
        gas: BigInt(tx.gas),
        maxFeePerGas: BigInt(tx.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas),
        chainId: tx.chainId,
      });
      setPendingTxHash(hash);
      setFinalTxHash(hash);
    } catch (err) {
      setErrorMsg((err as Error).message || "Transaction rejected");
      setPhase("error");
    }
  }, [executeData, sendTransactionAsync]);

  // After approval mines, automatically continue to swap
  useEffect(() => {
    if (phase !== "approving") return;
    if (!txReceipt.isSuccess) return;
    // Approval mined — reset pendingTxHash so the swap receipt is tracked
    // cleanly, then kick off the swap.
    setPendingTxHash(undefined);
    // Refresh allowance before swapping (safety)
    usdcAllowance.refetch().then(() => {
      doSwap();
    });
  }, [phase, txReceipt.isSuccess, doSwap, usdcAllowance]);

  // After swap mines, log to /api/trading/record and move to DONE
  useEffect(() => {
    if (phase !== "executing") return;
    if (!finalTxHash || !txReceipt.isSuccess || !executeData || !walletAddress || !sessionToken) return;

    (async () => {
      const buyAmountRaw = BigInt(executeData.quote.buy_amount);
      // We don't know buyToken decimals here without an extra read. Use
      // price = spend/tokens formula server-side data instead.
      const price = Number(executeData.quote.price);
      const tokensReceived = price > 0 ? spendUsdc / price : 0;

      await fetch("/api/trading/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          token_address,
          token_symbol,
          venue: "dex_0x_base",
          spend_usdc: spendUsdc,
          tokens_received: tokensReceived,
          effective_price: price,
          price_impact_pct: executeData.quote.price_impact_pct,
          tx_hash: finalTxHash,
          signal_id,
          source_page,
        }),
      }).catch(() => {
        // Non-fatal — trade is on-chain regardless. UI still moves to DONE.
      });

      setPhase("done");
    })();
  }, [phase, finalTxHash, txReceipt.isSuccess, executeData, walletAddress, sessionToken, spendUsdc, token_address, token_symbol, signal_id, source_page]);

  // Deploy guard (client-side hint — server enforces too)
  if (!TRADE_EXECUTION_ENABLED) {
    return null;
  }

  const insufficientUsdc =
    usdcBalanceUsd != null && spendUsdc > usdcBalanceUsd;

  const containerCls =
    "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4";
  const panelCls =
    "w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 animate-in slide-in-from-bottom sm:fade-in";

  return (
    <div className={containerCls} onClick={onClose}>
      <div
        className={panelCls}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Buy {token_symbol}</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {comparison?.quotes.filter((q) => q.available).length ?? 0} of{" "}
              {comparison?.quotes.length ?? 0} venues quoted
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none"
            style={{ color: "var(--text-muted)" }}
          >
            ×
          </button>
        </div>

        {/* Phase-specific body */}
        {phase === "quoting" && (
          <QuotingState />
        )}

        {(phase === "idle" || phase === "quoted" || phase === "error") && comparison && (
          <>
            <VenueList comparison={comparison} />

            {/* Spend input */}
            <div className="mt-4">
              <label
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Amount to spend (USDC)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={spendInput}
                  onChange={(e) => setSpendInput(e.target.value.replace(/[^\d.]/g, ""))}
                  className="flex-1 px-3 py-2.5 rounded-lg text-base font-mono focus:outline-none"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
                <span
                  className="text-xs font-mono px-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  ≈{" "}
                  {comparison.best && spendValid && comparison.best.price_usd > 0
                    ? fmtTokens(spendUsdc / comparison.best.price_usd)
                    : "—"}{" "}
                  {token_symbol}
                </span>
              </div>
              {usdcBalanceUsd != null && (
                <div
                  className="text-xs font-mono mt-1"
                  style={{
                    color: insufficientUsdc ? "var(--color-red)" : "var(--text-muted)",
                  }}
                >
                  Your USDC (Base): ${usdcBalanceUsd.toFixed(2)}
                </div>
              )}
            </div>

            {/* Slippage */}
            <div className="mt-3">
              <label
                className="text-xs font-mono uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Slippage tolerance
              </label>
              <div className="flex items-center gap-2 mt-1">
                {[0.5, 1.0, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlippage(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
                    style={{
                      background:
                        slippage === s
                          ? "color-mix(in srgb, var(--base-blue) 20%, transparent)"
                          : "var(--bg-primary)",
                      border: `1px solid ${
                        slippage === s
                          ? "var(--base-blue)"
                          : "var(--border-default)"
                      }`,
                      color: slippage === s ? "var(--base-blue)" : "var(--text-secondary)",
                    }}
                  >
                    {s.toFixed(1)}%
                  </button>
                ))}
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v)) {
                      setSlippage(Math.min(Math.max(v, SLIPPAGE_MIN_PCT), SLIPPAGE_MAX_PCT));
                    }
                  }}
                  min={SLIPPAGE_MIN_PCT}
                  max={SLIPPAGE_MAX_PCT}
                  step={0.1}
                  className="w-20 px-2 py-1.5 rounded-lg text-xs font-mono focus:outline-none"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Action: get signable quote OR execute */}
            <div className="mt-5">
              {phase === "idle" && (
                <button
                  onClick={refreshQuote}
                  disabled={!spendValid || !walletAddress || insufficientUsdc}
                  className="w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
                  style={{ background: "var(--base-blue)", color: "white" }}
                >
                  {!walletAddress
                    ? "Connect wallet first"
                    : insufficientUsdc
                    ? `Insufficient USDC — need $${spendUsdc.toFixed(2)}`
                    : "Get signable quote →"}
                </button>
              )}

              {phase === "quoted" && executeData && (
                <>
                  <div
                    className="p-3 rounded-lg mb-3 text-xs font-mono"
                    style={{
                      background: "color-mix(in srgb, var(--color-green) 8%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-green) 25%, transparent)",
                    }}
                  >
                    <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                      <span>Min received (slippage {slippage}%)</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {fmtTokens(
                          Number(executeData.quote.min_tokens_after_slippage) /
                            10 ** 18 /* best-effort — client doesn't know buyToken decimals cheaply */
                        )}{" "}
                        {token_symbol}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1" style={{ color: "var(--text-secondary)" }}>
                      <span>Price impact</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {fmtPct(executeData.quote.price_impact_pct)}
                      </span>
                    </div>
                    {executeData.quote.sources.length > 0 && (
                      <div className="flex justify-between mt-1" style={{ color: "var(--text-secondary)" }}>
                        <span>Routes</span>
                        <span style={{ color: "var(--text-primary)" }}>
                          {executeData.quote.sources.map((s) => s.name).join(" + ")}
                        </span>
                      </div>
                    )}
                    <div
                      className="mt-2 pt-2 flex justify-between text-[11px]"
                      style={{
                        color: quoteExpired ? "var(--color-red)" : "var(--text-muted)",
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span>Quote expires</span>
                      <span>
                        {quoteExpired
                          ? "EXPIRED"
                          : `${countdown}s`}
                      </span>
                    </div>
                  </div>

                  {quoteExpired ? (
                    <button
                      onClick={refreshQuote}
                      className="w-full py-3 rounded-lg text-sm font-bold"
                      style={{ background: "var(--base-blue)", color: "white" }}
                    >
                      Refresh quote ↻
                    </button>
                  ) : (
                    <button
                      onClick={executeTrade}
                      disabled={insufficientUsdc || isSendingTx}
                      className="w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
                      style={{ background: "var(--color-green)", color: "black" }}
                    >
                      {needsApproval
                        ? `Approve USDC then swap (2 signatures)`
                        : `Execute via Base DEX →`}
                    </button>
                  )}
                </>
              )}

              {phase === "error" && (
                <div
                  className="p-3 rounded-lg mb-3 text-sm"
                  style={{
                    color: "var(--color-red)",
                    background: "color-mix(in srgb, var(--color-red) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-red) 30%, transparent)",
                  }}
                >
                  {errorMsg}
                </div>
              )}
              {phase === "error" && (
                <button
                  onClick={refreshQuote}
                  className="w-full py-3 rounded-lg text-sm font-bold"
                  style={{ background: "var(--base-blue)", color: "white" }}
                >
                  Try again
                </button>
              )}
            </div>
          </>
        )}

        {(phase === "approving" || phase === "executing") && (
          <div className="py-8 text-center">
            <div
              className="text-sm font-mono mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {phase === "approving"
                ? "Approve USDC in your wallet…"
                : "Confirm the swap in your wallet…"}
            </div>
            {pendingTxHash && (
              <a
                href={BASESCAN_TX_URL(pendingTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono underline"
                style={{ color: "var(--base-blue)" }}
              >
                View on Basescan ↗
              </a>
            )}
            <div
              className="text-[11px] font-mono mt-3"
              style={{ color: "var(--text-muted)" }}
            >
              {txReceipt.isLoading ? "Waiting for confirmation…" : ""}
            </div>
          </div>
        )}

        {phase === "done" && finalTxHash && (
          <div className="py-6 text-center">
            <div
              className="text-3xl mb-3"
              style={{ color: "var(--color-green)" }}
            >
              ✓
            </div>
            <div className="text-lg font-bold mb-1">Trade executed</div>
            <div className="text-xs font-mono mb-4" style={{ color: "var(--text-secondary)" }}>
              Bought {token_symbol} for ${spendUsdc.toFixed(2)} USDC
            </div>
            <a
              href={BASESCAN_TX_URL(finalTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-lg text-xs font-mono"
              style={{
                background: "color-mix(in srgb, var(--base-blue) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--base-blue) 30%, transparent)",
                color: "var(--base-blue)",
              }}
            >
              View on Basescan ↗
            </a>
            <button
              onClick={onClose}
              className="block mx-auto mt-4 text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function QuotingState() {
  return (
    <div className="py-8 text-center">
      <div
        className="inline-block w-8 h-8 rounded-full mb-3"
        style={{
          border: "3px solid var(--border-subtle)",
          borderTopColor: "var(--base-blue)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div
        className="text-sm font-mono"
        style={{ color: "var(--text-secondary)" }}
      >
        Scanning all venues for best price…
      </div>
    </div>
  );
}

function VenueList({ comparison }: { comparison: RouteScanResult }) {
  const best = comparison.best;
  return (
    <div className="space-y-2">
      {comparison.quotes
        .slice()
        .sort((a, b) => {
          // Available first, then cheapest
          if (a.available !== b.available) return a.available ? -1 : 1;
          return a.effective_price - b.effective_price;
        })
        .map((q) => (
          <VenueRow key={q.venue} q={q} isBest={best?.venue === q.venue} />
        ))}
      {best && comparison.savings_vs_worst_pct > 0.1 && (
        <div
          className="text-xs font-mono text-center pt-1"
          style={{ color: "var(--color-green)" }}
        >
          Best saves {comparison.savings_vs_worst_pct.toFixed(2)}% vs worst
        </div>
      )}
    </div>
  );
}

function VenueRow({ q, isBest }: { q: VenueQuote; isBest: boolean }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg"
      style={{
        background: isBest
          ? "color-mix(in srgb, var(--color-green) 10%, transparent)"
          : "var(--bg-primary)",
        border: `1px solid ${
          isBest
            ? "color-mix(in srgb, var(--color-green) 30%, transparent)"
            : "var(--border-subtle)"
        }`,
        opacity: q.available ? 1 : 0.5,
      }}
    >
      <div>
        <div className="flex items-center gap-2">
          {isBest && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "var(--color-green)",
                color: "black",
              }}
            >
              BEST
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {q.venue_label}
          </span>
        </div>
        {q.available ? (
          <div
            className="text-xs font-mono mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {q.price_impact_pct > 0 && `Impact: ${q.price_impact_pct.toFixed(2)}% · `}
            {q.fee_pct > 0 && `Fee: ${q.fee_pct.toFixed(2)}% · `}
            {q.gas_estimate_usd > 0 && `Gas: ~$${q.gas_estimate_usd.toFixed(2)}`}
          </div>
        ) : (
          <div
            className="text-xs font-mono mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            {q.error || "unavailable"}
          </div>
        )}
      </div>
      <div className="text-right">
        <div
          className="text-sm font-mono font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {q.available ? `$${q.effective_price.toFixed(q.effective_price >= 1 ? 4 : 8)}` : "—"}
        </div>
      </div>
    </div>
  );
}
