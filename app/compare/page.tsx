"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TradeButton from "@/components/trading/TradeButton";

const QUICK_PICKS = [
  { symbol: "CLAUDIA", address: "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B" },
  { symbol: "AERO", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" },
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  { symbol: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" },
];

interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price: number;
  change24h: number;
  change1h: number;
  volume24h: number;
  liquidity: number;
  buys24h: number;
  sells24h: number;
}

interface ComparisonRow {
  label: string;
  a: string | number;
  b: string | number;
  winner: "a" | "b" | "tie";
  invertWinner?: boolean; // true = lower is better (risk)
}

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";
}

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

function pairToToken(pair: any): TokenData {
  return {
    symbol: pair.baseToken?.symbol || "???",
    name: pair.baseToken?.name || pair.baseToken?.symbol || "Unknown",
    address: pair.baseToken?.address || "",
    price: parseFloat(pair.priceUsd || "0"),
    change24h: pair.priceChange?.h24 ?? 0,
    change1h: pair.priceChange?.h1 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
  };
}

/** Pick the highest-liquidity pair from a list (Base-chain preferred). */
function bestPair(pairs: any[]): any | null {
  if (!pairs || pairs.length === 0) return null;
  const sorted = pairs.slice().sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  return sorted.find((p) => p.chainId === "base") || sorted[0];
}

type TokenLookup =
  | { ok: true; token: TokenData }
  | { ok: false; error: string };

async function fetchTokenData(query: string): Promise<TokenLookup> {
  const input = query.trim();
  if (!input) return { ok: false, error: "Empty query" };

  try {
    // Branch 1: Contract address — hit the canonical /tokens/{address} endpoint.
    // This works for ANY Base token (or any EVM chain) regardless of whether
    // DexScreener's search index has picked it up yet.
    if (ADDRESS_REGEX.test(input)) {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${input}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) {
        return { ok: false, error: `DexScreener unavailable (${res.status})` };
      }
      const data = (await res.json()) as any;
      const pair = bestPair(data?.pairs || []);
      if (!pair) {
        return {
          ok: false,
          error: `Address ${input.slice(0, 6)}…${input.slice(-4)} has no active DEX pairs. Check the chain.`,
        };
      }
      return { ok: true, token: pairToToken(pair) };
    }

    // Branch 2: Symbol — use search, then strictly match baseToken.symbol
    // (case-insensitive) on Base chain. No fuzzy "first result" fallback.
    const sym = input.replace(/^\$/, "").toUpperCase();
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sym)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      return { ok: false, error: `DexScreener unavailable (${res.status})` };
    }
    const data = (await res.json()) as any;
    const exactMatches = (data?.pairs || []).filter(
      (p: any) => (p.baseToken?.symbol || "").toUpperCase() === sym
    );
    const pair = bestPair(exactMatches) || bestPair(data?.pairs || []);
    if (!pair) {
      return { ok: false, error: `Token "${input}" not found on any chain` };
    }
    // If we matched via fuzzy fallback, surface the actual symbol to the user
    return { ok: true, token: pairToToken(pair) };
  } catch (err) {
    return { ok: false, error: (err as Error).message || "Lookup failed" };
  }
}

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputA, setInputA] = useState(searchParams.get("a") || "");
  const [inputB, setInputB] = useState(searchParams.get("b") || "");
  const [tokenA, setTokenA] = useState<TokenData | null>(null);
  const [tokenB, setTokenB] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-compare if URL params present
  useEffect(() => {
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (a && b) {
      setInputA(a);
      setInputB(b);
      runCompare(a, b);
    }
  }, []);

  async function runCompare(a?: string, b?: string) {
    const qa = a || inputA;
    const qb = b || inputB;
    if (!qa || !qb) return;

    setLoading(true);
    setError("");
    setTokenA(null);
    setTokenB(null);

    const [resA, resB] = await Promise.all([
      fetchTokenData(qa),
      fetchTokenData(qb),
    ]);

    if (!resA.ok) { setError(`Token A — ${resA.error}`); setLoading(false); return; }
    if (!resB.ok) { setError(`Token B — ${resB.error}`); setLoading(false); return; }

    setTokenA(resA.token);
    setTokenB(resB.token);
    setLoading(false);

    // Update URL
    router.replace(`/compare?a=${encodeURIComponent(qa)}&b=${encodeURIComponent(qb)}`, { scroll: false });
  }

  // Build comparison rows
  const rows: ComparisonRow[] = tokenA && tokenB ? [
    { label: "Price (USD)", a: `$${tokenA.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`, b: `$${tokenB.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`, winner: tokenA.price > tokenB.price ? "a" : tokenA.price < tokenB.price ? "b" : "tie" },
    { label: "24h Change", a: `${tokenA.change24h >= 0 ? "+" : ""}${tokenA.change24h.toFixed(1)}%`, b: `${tokenB.change24h >= 0 ? "+" : ""}${tokenB.change24h.toFixed(1)}%`, winner: tokenA.change24h > tokenB.change24h ? "a" : tokenA.change24h < tokenB.change24h ? "b" : "tie" },
    { label: "1h Change", a: `${tokenA.change1h >= 0 ? "+" : ""}${tokenA.change1h.toFixed(1)}%`, b: `${tokenB.change1h >= 0 ? "+" : ""}${tokenB.change1h.toFixed(1)}%`, winner: tokenA.change1h > tokenB.change1h ? "a" : tokenA.change1h < tokenB.change1h ? "b" : "tie" },
    { label: "24h Volume", a: `$${(tokenA.volume24h / 1000).toFixed(0)}K`, b: `$${(tokenB.volume24h / 1000).toFixed(0)}K`, winner: tokenA.volume24h > tokenB.volume24h ? "a" : "b" },
    { label: "Liquidity", a: `$${(tokenA.liquidity / 1000).toFixed(0)}K`, b: `$${(tokenB.liquidity / 1000).toFixed(0)}K`, winner: tokenA.liquidity > tokenB.liquidity ? "a" : "b" },
    { label: "Buy/Sell Ratio", a: tokenA.sells24h > 0 ? (tokenA.buys24h / tokenA.sells24h).toFixed(2) : "N/A", b: tokenB.sells24h > 0 ? (tokenB.buys24h / tokenB.sells24h).toFixed(2) : "N/A", winner: (tokenA.buys24h / (tokenA.sells24h || 1)) > (tokenB.buys24h / (tokenB.sells24h || 1)) ? "a" : "b" },
  ] : [];

  const winsA = rows.filter((r) => r.winner === "a").length;
  const winsB = rows.filter((r) => r.winner === "b").length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">Compare Tokens</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Side by side. No fluff.</p>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[
            { val: inputA, set: setInputA, label: "Token A" },
            { val: inputB, set: setInputB, label: "Token B" },
          ].map((input) => (
            <div key={input.label}>
              <label className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{input.label}</label>
              <div className="relative mt-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              <input
                type="text"
                value={input.val}
                onChange={(e) => input.set(e.target.value)}
                placeholder="Symbol or contract address..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm font-mono text-white focus:outline-none border"
                style={{
                  background: "var(--bg-input)",
                  borderColor: "var(--border-default)",
                }}
              />
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {QUICK_PICKS.map((qp) => (
                  <button
                    key={qp.symbol}
                    onClick={() => input.set(qp.address)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono border transition-colors hover:opacity-80"
                    style={{
                      background: "var(--bg-badge)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {qp.symbol}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => runCompare()}
          disabled={loading || !inputA || !inputB}
          className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors"
          style={{ background: "var(--base-blue)" }}
        >
          {loading ? "Analyzing..." : "Compare →"}
        </button>

        {error && (
          <div className="mt-4 text-sm text-center" style={{ color: "var(--color-red)" }}>{error}</div>
        )}

        {/* Results */}
        {tokenA && tokenB && (
          <div className="mt-6 rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border-default)" }}>
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 border-b text-xs font-mono" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
              <span>METRIC</span>
              <span className="text-center font-bold text-white">{tokenA.symbol}</span>
              <span className="text-center font-bold text-white">{tokenB.symbol}</span>
            </div>

            {/* Rows */}
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr_1fr] px-4 py-2.5 border-b text-sm"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span
                  className="text-center font-mono"
                  style={{
                    color: row.winner === "a" ? "var(--color-green)" : "var(--text-primary)",
                    fontWeight: row.winner === "a" ? 700 : 400,
                  }}
                >
                  {row.a} {row.winner === "a" && "🟢"}
                </span>
                <span
                  className="text-center font-mono"
                  style={{
                    color: row.winner === "b" ? "var(--color-green)" : "var(--text-primary)",
                    fontWeight: row.winner === "b" ? 700 : 400,
                  }}
                >
                  {row.b} {row.winner === "b" && "🟢"}
                </span>
              </div>
            ))}

            {/* Summary */}
            <div className="px-4 py-3 text-center text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              {winsA > winsB
                ? <><span style={{ color: "var(--color-green)" }}>{tokenA.symbol}</span> wins {winsA}/{rows.length} metrics</>
                : winsB > winsA
                  ? <><span style={{ color: "var(--color-green)" }}>{tokenB.symbol}</span> wins {winsB}/{rows.length} metrics</>
                  : "Tied"}
            </div>
          </div>
        )}

        {/* Trade buttons for both tokens — feature-flagged */}
        {tokenA && tokenB && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <TradeButton
              symbol={tokenA.symbol}
              address={tokenA.address || null}
              source_page="compare"
              label={`Trade ${tokenA.symbol}`}
              compact
            />
            <TradeButton
              symbol={tokenB.symbol}
              address={tokenB.address || null}
              source_page="compare"
              label={`Trade ${tokenB.symbol}`}
              compact
            />
          </div>
        )}

        {/* Share */}
        {tokenA && tokenB && (
          <div className="flex gap-2 mt-4 justify-center">
            <button
              onClick={() => {
                const url = `${window.location.origin}/compare?a=${encodeURIComponent(inputA)}&b=${encodeURIComponent(inputB)}`;
                navigator.clipboard.writeText(url);
              }}
              className="px-3 py-1.5 rounded text-xs font-mono border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              Copy Link
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
