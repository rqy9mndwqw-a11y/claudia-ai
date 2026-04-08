"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { Pool } from "@/hooks/usePools";

interface ComparisonPanelProps {
  pools: Pool[];
  sessionToken: string | null | undefined;
  onClose: () => void;
}

interface ComparisonPick {
  poolId: string;
  protocol: string;
  symbol: string;
  apy: number;
  monthlyEarnings: number;
  annualEarnings: number;
  take: string;
}

interface ComparisonResult {
  picks: ComparisonPick[];
  summary: string;
}

type AssetType = "Stables" | "ETH" | "BTC" | "Other";

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "Stables", label: "Stablecoins" },
  { value: "ETH", label: "ETH" },
  { value: "BTC", label: "BTC" },
  { value: "Other", label: "Other" },
];

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function filterPoolsByAsset(pools: Pool[], assetType: AssetType): Pool[] {
  switch (assetType) {
    case "Stables":
      return pools.filter((p) => p.stablecoin);
    case "ETH":
      return pools.filter((p) => /eth|weth/i.test(p.symbol));
    case "BTC":
      return pools.filter((p) => /btc|wbtc|cbbtc/i.test(p.symbol));
    case "Other":
    default:
      return pools;
  }
}

export default function ComparisonPanel({ pools, sessionToken, onClose }: ComparisonPanelProps) {
  const [amount, setAmount] = useState<string>("1000");
  const [assetType, setAssetType] = useState<AssetType>("Stables");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevantPools = useMemo(() => filterPoolsByAsset(pools, assetType), [pools, assetType]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleCompare = useCallback(async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    if (!sessionToken) {
      setError("Connect your wallet first.");
      return;
    }
    if (relevantPools.length === 0) {
      setError(`No ${assetType} pools found. Try a different asset type.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/claudia/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          amount: numAmount,
          assetType,
          pools: relevantPools.slice(0, 15).map((p) => ({
            id: p.id,
            protocol: p.protocol,
            chain: p.chain,
            symbol: p.symbol,
            apy: p.apy,
            apyBase: p.apyBase,
            apyReward: p.apyReward,
            tvlUsd: p.tvlUsd,
            ilRisk: p.ilRisk,
            stablecoin: p.stablecoin,
            riskScore: p.riskScore,
          })),
        }),
      });

      const data = await (res.json() as Promise<any>).catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        return;
      }

      setResult(data);
    } catch {
      setError("Failed to get comparison. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [amount, assetType, relevantPools, sessionToken]);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg border-l border-white/10 shadow-2xl z-[70] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h2 className="font-heading font-bold text-white text-lg">Compare Yields</h2>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors text-sm"
        >
          Close
        </button>
      </div>

      {/* Inputs */}
      <div className="px-5 py-4 space-y-4 border-b border-white/5">
        {/* Amount */}
        <div>
          <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              min="1"
              max="10000000"
              className="w-full bg-surface border border-white/10 rounded-lg pl-7 pr-3 py-2.5
                         text-white text-sm outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        {/* Asset type */}
        <div>
          <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
            Asset Type
          </label>
          <div className="flex gap-2">
            {ASSET_TYPES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAssetType(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex-1 ${
                  assetType === opt.value
                    ? "bg-accent text-white"
                    : "bg-surface-light text-zinc-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-1">
            {relevantPools.length} matching pools
          </p>
        </div>

        {/* Compare button */}
        <button
          onClick={handleCompare}
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider transition-all ${
            isLoading
              ? "bg-accent/20 text-accent animate-pulse cursor-wait"
              : "bg-accent hover:bg-[#27c00e] text-white"
          }`}
        >
          {isLoading ? "Claudia is thinking..." : "Compare"}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {result && result.picks.length > 0 && (
          <>
            {result.picks.map((pick, i) => (
              <div
                key={pick.poolId || i}
                className="bg-surface rounded-xl border border-white/5 p-4 space-y-2"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold text-sm">{pick.protocol}</span>
                    <span className="text-zinc-500 text-xs ml-2">{pick.symbol}</span>
                  </div>
                  <span className="text-accent font-heading font-bold text-lg">
                    {pick.apy.toFixed(1)}%
                  </span>
                </div>

                {/* Earnings */}
                <div className="flex gap-3">
                  <div className="bg-white/5 rounded-lg px-3 py-1.5 flex-1">
                    <p className="text-[11px] text-zinc-500 uppercase">Monthly</p>
                    <p className="text-white font-bold text-sm">{formatUsd(pick.monthlyEarnings)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg px-3 py-1.5 flex-1">
                    <p className="text-[11px] text-zinc-500 uppercase">Annual</p>
                    <p className="text-green-400 font-bold text-sm">{formatUsd(pick.annualEarnings)}</p>
                  </div>
                </div>

                {/* Claudia's take */}
                <p className="text-zinc-400 text-xs leading-relaxed italic">
                  &ldquo;{pick.take}&rdquo;
                </p>
              </div>
            ))}

            {/* Summary */}
            {result.summary && (
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mt-2">
                <p className="text-[11px] text-accent uppercase font-bold mb-1">Claudia&apos;s Verdict</p>
                <p className="text-zinc-300 text-sm leading-relaxed">{result.summary}</p>
              </div>
            )}
          </>
        )}

        {result && result.picks.length === 0 && result.summary && (
          <div className="bg-surface rounded-xl border border-white/5 p-4">
            <p className="text-zinc-300 text-sm leading-relaxed">{result.summary}</p>
          </div>
        )}

        {!result && !error && !isLoading && (
          <div className="text-center py-8">
            <p className="text-zinc-600 text-sm">
              Enter an amount and click Compare.
            </p>
            <p className="text-zinc-700 text-xs mt-1">
              Claudia will pick the best yields for your money.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
