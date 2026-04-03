"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import { useSessionToken } from "@/hooks/useSessionToken";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";
import type { ScanResult } from "@/lib/scanner/market-scanner";
import TradingViewChart from "@/components/TradingViewChart";

interface ScanData {
  scannedAt: number;
  pairCount: number;
  results: ScanResult[];
  summary: string;
  topPicks: ScanResult[];
  marketMood: string;
  nextScan: number;
}

const RATING_BADGE: Record<string, string> = {
  STRONG_BUY: "text-green-400 bg-green-500/10 border-green-500/50",
  BUY: "text-green-400 bg-green-500/10 border-green-500/40",
  HOLD: "text-amber-400 bg-amber-500/10 border-amber-500/50",
  SELL: "text-red-400 bg-red-500/10 border-red-500/50",
  STRONG_SELL: "text-red-400 bg-red-500/10 border-red-500/40",
};

const ROW_HOVER_GLOW: Record<string, string> = {
  STRONG_BUY: "hover:shadow-[inset_0_0_30px_rgba(34,197,94,0.04)]",
  BUY: "hover:shadow-[inset_0_0_30px_rgba(34,197,94,0.03)]",
  HOLD: "hover:shadow-[inset_0_0_30px_rgba(245,158,11,0.03)]",
  SELL: "hover:shadow-[inset_0_0_30px_rgba(239,68,68,0.03)]",
  STRONG_SELL: "hover:shadow-[inset_0_0_30px_rgba(239,68,68,0.04)]",
};

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function isStale(ts: number): boolean {
  return Date.now() - ts > 4 * 60 * 60 * 1000; // > 4 hours
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(6)}`;
}

// ── Segmented Power Bar (5 blocks for score 1-10) ──

function PowerBar({ score }: { score: number }) {
  const blocks = 5;
  const filled = Math.round((score / 10) * blocks);
  const color = score >= 7 ? "bg-green-400" : score >= 4 ? "bg-amber-400" : "bg-red-400";
  const dimColor = score >= 7 ? "bg-green-400/15" : score >= 4 ? "bg-amber-400/15" : "bg-red-400/15";

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {Array.from({ length: blocks }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-3 rounded-[2px] transition-all ${i < filled ? color : dimColor}`}
          />
        ))}
      </div>
      <span className="text-[11px] font-mono text-white/70 ml-1.5 w-4">{score}</span>
    </div>
  );
}

// ── Market Mood HUD ──

function MarketMoodHUD({ mood, results }: { mood: string; results: ScanResult[] }) {
  const avgScore = results.length > 0
    ? (results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 5;
  const pct = (avgScore / 10) * 100;

  const buyCount = results.filter((r) => r.rating === "STRONG_BUY" || r.rating === "BUY").length;
  const holdCount = results.filter((r) => r.rating === "HOLD").length;
  const sellCount = results.filter((r) => r.rating === "SELL" || r.rating === "STRONG_SELL").length;

  return (
    <div className="bg-surface rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Global Sentiment</p>
          <p className="font-heading font-bold text-white text-3xl mt-1">
            {avgScore.toFixed(1)}<span className="text-zinc-600 text-lg">/10</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
            mood === "bullish" ? "text-green-400 border-green-500/40 bg-green-500/10" :
            mood === "bearish" ? "text-red-400 border-red-500/40 bg-red-500/10" :
            mood === "mixed" ? "text-amber-400 border-amber-500/40 bg-amber-500/10 animate-glow-amber" :
            "text-zinc-400 border-zinc-500/40 bg-zinc-500/10"
          }`}>
            {mood.toUpperCase()}
          </span>
          <div className="flex gap-3 mt-2 text-[10px] font-mono">
            <span className="text-green-400">{buyCount} BUY</span>
            <span className="text-amber-400">{holdCount} HOLD</span>
            <span className="text-red-400">{sellCount} SELL</span>
          </div>
        </div>
      </div>

      {/* Heat map bar */}
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-surface-light">
        <div className="absolute inset-0 flex">
          <div className="bg-red-500/60 h-full" style={{ width: "30%" }} />
          <div className={`bg-amber-400/60 h-full ${mood === "mixed" ? "animate-burn-gold" : ""}`} style={{ width: "40%" }} />
          <div className="bg-green-500/60 h-full" style={{ width: "30%" }} />
        </div>
        {/* Indicator needle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-all duration-500"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
        <span>BEARISH</span>
        <span>NEUTRAL</span>
        <span>BULLISH</span>
      </div>
    </div>
  );
}

// ── Swarm Target Icon ──

function SwarmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// ── Pair Detail Drawer ──

function PairDrawer({
  pair, open, onClose, scannedAt, sessionToken,
}: {
  pair: ScanResult | null; open: boolean; onClose: () => void; scannedAt: number; sessionToken: string | null;
}) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleFullAnalysis = async () => {
    if (!pair || !sessionToken || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/agents/full-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ message: `Full analysis on ${pair.symbol}` }),
      });
      const data = (await res.json()) as any;
      if (data.analysisId) { onClose(); router.push(`/analysis/${data.analysisId}`); }
      else { setAnalysisError(data.error || "Analysis failed. Try again."); }
    } catch { setAnalysisError("network error. try again."); }
    finally { setIsAnalyzing(false); }
  };

  if (!pair) return null;

  const scoreColor = pair.score >= 7 ? "text-green-400" : pair.score >= 4 ? "text-amber-400" : "text-red-400";
  const barColor = pair.score >= 7 ? "bg-green-400" : pair.score >= 4 ? "bg-amber-400" : "bg-red-400";

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />}
      <div className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-bg border-l border-white/10 z-50 transform transition-transform duration-300 ease-out overflow-y-auto ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-white font-heading text-2xl">{pair.symbol}</h2>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${RATING_BADGE[pair.rating] || ""}`}>
                  {pair.rating.replace("_", " ")}
                </span>
              </div>
              <p className="text-zinc-400 text-sm font-mono">
                {formatPrice(pair.price)}
                <span className={`ml-2 ${pair.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pair.change24h >= 0 ? "+" : ""}{pair.change24h.toFixed(2)}%
                </span>
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl p-1">&#10005;</button>
          </div>

          {/* Mini chart */}
          <div className="mb-4">
            <TradingViewChart symbol={pair.symbol} interval="60" height={250} />
          </div>

          <div className="bg-surface rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-mono">Score</p>
              <span className={`text-2xl font-heading font-bold ${scoreColor}`}>{pair.score}/10</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pair.score * 10}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">RSI {pair.rsi}</span>
            <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs font-mono text-zinc-300">
              {pair.change24h >= 0 ? "+" : ""}{pair.change24h.toFixed(2)}% 24h
            </span>
          </div>

          <div className="bg-surface rounded-2xl p-4 mb-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-mono mb-2">Top Signal</p>
            <p className="text-zinc-200 text-sm">{pair.topSignal}</p>
          </div>

          <div className="bg-surface rounded-2xl p-4 mb-6 border border-accent/10">
            <p className="text-xs text-accent uppercase tracking-wider font-mono mb-2">CLAUDIA</p>
            <p className="text-zinc-200 text-sm leading-relaxed">{pair.reasoning}</p>
          </div>

          <div className="border-t border-white/10 pt-6 mb-4">
            <p className="text-zinc-500 text-sm mb-1">want the full picture?</p>
            <p className="text-zinc-600 text-xs mb-4">multi-agent deep dive — Chart Reader, Risk Manager, Token Analyst and more</p>
          </div>

          {analysisError && <p className="text-red-400 text-xs mb-2">{analysisError}</p>}
          <button
            onClick={handleFullAnalysis}
            disabled={isAnalyzing}
            className="w-full bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-500 disabled:opacity-50 text-white font-heading font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mb-3 shadow-lg shadow-accent/20 animate-glow-pink"
          >
            {isAnalyzing ? (
              <><span className="animate-spin">&#9889;</span> Running analysis...</>
            ) : (
              <><span>&#9889;</span> Full Analysis &mdash; 6-10 credits</>
            )}
          </button>

          <p className="text-zinc-700 text-xs text-center mt-4 font-mono">
            scanned {timeAgo(scannedAt)} &middot; scores update every 2 hours
          </p>
        </div>
      </div>
    </>
  );
}

// ── Scanner Content ──

function ScannerContent({ sessionToken }: { sessionToken: string | null }) {
  const router = useRouter();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "change" | "rsi">("score");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedPair, setSelectedPair] = useState<ScanResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const handleRowClick = (pair: ScanResult) => { setSelectedPair(pair); setDrawerOpen(true); };

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const fetchScan = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scanner", { headers: { Authorization: `Bearer ${sessionToken}` } });
      if (res.status === 404) { setError("first scan hasn't run yet. check back in a bit."); return; }
      if (!res.ok) throw new Error("something broke. not my fault.");
      setScan((await res.json()) as any);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [sessionToken]);

  const handleManualRefresh = async () => {
    if (isRefreshing || cooldownRemaining > 0 || !sessionToken) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/scanner/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
      });
      const data = (await res.json()) as any;
      if (res.status === 429) { setCooldownRemaining(data.cooldownRemaining || 600); return; }
      if (res.status === 402) { router.push("/credits"); return; }
      if (res.ok) { await fetchScan(); setCooldownRemaining(600); }
    } catch {} finally { setIsRefreshing(false); }
  };

  useEffect(() => { fetchScan(); }, [fetchScan]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-4xl">&#128225;</p>
        <p className="text-zinc-400 text-sm">{error || "no scan data. probably nothing."}</p>
        <button onClick={fetchScan} className="text-accent text-xs hover:underline">refresh</button>
      </div>
    );
  }

  let filtered = scan.results;
  if (ratingFilter !== "all") filtered = filtered.filter((r) => r.rating === ratingFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    if (sortBy === "change") return b.change24h - a.change24h;
    return a.rsi - b.rsi;
  });

  const staleData = isStale(scan.scannedAt);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-6 space-y-8">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-bold text-white text-xl">Market Scanner</h1>
            <p className={`text-[10px] font-mono mt-0.5 ${staleData ? "text-red-500 animate-pulse" : "text-zinc-600"}`}>
              Updated {timeAgo(scan.scannedAt)} &middot; {scan.pairCount} pairs &middot; auto-scan every 2h
              {staleData && " \u2022 STALE DATA"}
            </p>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || cooldownRemaining > 0}
            className="flex items-center gap-1.5 bg-surface hover:bg-surface/80 disabled:opacity-40 border border-white/10 hover:border-accent/30 text-zinc-300 hover:text-white text-xs font-mono px-3 py-1.5 rounded-lg transition-all"
          >
            {isRefreshing ? (
              <><span className="animate-spin text-accent">&#9889;</span> Scanning...</>
            ) : cooldownRemaining > 0 ? (
              <>{Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, "0")}</>
            ) : (
              <>&#9889; Refresh &middot; 3cr</>
            )}
          </button>
        </div>

        {/* Market Mood HUD */}
        <MarketMoodHUD mood={scan.marketMood} results={scan.results} />

        {/* Summary */}
        <div className="bg-surface/50 border-l-2 border-accent/40 rounded-r-xl p-4">
          <p className="text-zinc-300 text-sm leading-relaxed">{scan.summary}</p>
        </div>

        {/* Filters + sort */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5">
            {["all", "STRONG_BUY", "BUY", "HOLD", "SELL"].map((f) => (
              <button
                key={f}
                onClick={() => setRatingFilter(f)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                  ratingFilter === f
                    ? "bg-white/10 text-white border-white/20"
                    : "text-zinc-600 border-transparent hover:text-zinc-400"
                }`}
              >
                {f === "all" ? "ALL" : f.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {([["score", "SCORE"], ["change", "24H"], ["rsi", "RSI"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${sortBy === key ? "bg-surface-light text-white" : "text-zinc-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tactical Table */}
        <div className="bg-surface/30 rounded-xl border border-white/5 overflow-hidden">
          {/* Header */}
          <div className="hidden sm:flex items-center gap-x-4 px-5 py-3 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-600 border-b border-white/5 bg-white/[0.02]">
            <div className="w-[140px] flex-shrink-0">SYMBOL</div>
            <div className="w-[90px] flex-shrink-0 text-right">PRICE</div>
            <div className="w-[60px] flex-shrink-0 text-right">24H</div>
            <div className="w-[85px] flex-shrink-0 text-center">SCORE</div>
            <div className="w-[45px] flex-shrink-0 text-right">RSI</div>
            <div className="flex-1 min-w-[120px]">SIGNAL</div>
            <div className="w-[36px] flex-shrink-0 text-center">&#9775;</div>
          </div>

          {/* Rows */}
          {sorted.map((r) => (
            <button
              key={r.ticker}
              onClick={() => handleRowClick(r)}
              className={`w-full flex items-center gap-x-4 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-all group text-left ${ROW_HOVER_GLOW[r.rating] || ""}`}
            >
              {/* Symbol + badge */}
              <div className="w-[140px] flex-shrink-0 flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-white group-hover:text-accent transition-colors">
                  {r.symbol}
                </span>
                <span className={`text-[9px] font-bold font-mono px-1.5 py-px rounded border whitespace-nowrap ${RATING_BADGE[r.rating] || ""}`}>
                  {r.rating.replace("_", " ")}
                </span>
              </div>

              {/* Price */}
              <div className="w-[90px] flex-shrink-0 text-right text-sm text-zinc-400 font-mono">
                {formatPrice(r.price)}
              </div>

              {/* 24h change */}
              <div className={`w-[60px] flex-shrink-0 text-right text-sm font-mono ${r.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {r.change24h >= 0 ? "+" : ""}{r.change24h.toFixed(1)}%
              </div>

              {/* Power bar */}
              <div className="w-[85px] flex-shrink-0 flex justify-center">
                <PowerBar score={r.score} />
              </div>

              {/* RSI */}
              <div className={`w-[45px] flex-shrink-0 text-right text-sm font-mono ${r.rsi < 30 ? "text-green-400" : r.rsi > 70 ? "text-red-400" : "text-zinc-500"}`}>
                {Math.round(r.rsi)}
              </div>

              {/* Signal */}
              <div className="flex-1 min-w-[120px] text-sm text-zinc-400 truncate">
                {r.topSignal}
              </div>

              {/* Swarm button — opens full analysis */}
              <div className="w-[36px] flex-shrink-0 flex justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRowClick(r); }}
                  className="p-1.5 rounded-lg hover:bg-accent/20 transition-all group/swarm"
                  title={`Full analysis ${r.symbol}`}
                >
                  <div className="group-hover/swarm:animate-glow-pink rounded-full">
                    <SwarmIcon />
                  </div>
                </button>
              </div>
            </button>
          ))}
        </div>

        <p className="text-zinc-700 text-[10px] font-mono text-center">
          {scan.pairCount} pairs scanned &middot; scores 1-10 &middot; not financial advice
        </p>
      </div>

      <PairDrawer
        pair={selectedPair}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        scannedAt={scan.scannedAt}
        sessionToken={sessionToken}
      />
    </div>
  );
}

export default function ScannerPage() {
  const { sessionToken } = useSessionToken();

  return (
    <DashboardLayout>
      <TokenGate minBalance={GATE_THRESHOLDS.dashboard} featureName="Market Scanner">
        <ScannerContent sessionToken={sessionToken} />
      </TokenGate>
    </DashboardLayout>
  );
}
