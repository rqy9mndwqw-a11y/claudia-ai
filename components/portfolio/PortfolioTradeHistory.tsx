"use client";

/**
 * Recent on-chain trades executed via the "Act on Signal" flow.
 * Renders nothing when there are no trades yet (zero-state handled by caller).
 *
 * Always fetches — this is the portfolio page, freshness matters more than
 * cost. If you want caching later, add it to /api/trading/history.
 */

import { useEffect, useState } from "react";
import { BASESCAN_TX_URL } from "@/lib/trading/config";

interface UserTrade {
  id: number;
  token_address: string;
  token_symbol: string;
  venue: string;
  spend_usdc: number;
  tokens_received: number;
  effective_price: number;
  price_impact_pct: number | null;
  gas_usd: number | null;
  tx_hash: string;
  signal_id: string | null;
  source_page: string | null;
  created_at: string;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return n.toLocaleString("en", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(3)}`;
}

function shortHash(h: string): string {
  return h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "";
}

export default function PortfolioTradeHistory({
  sessionToken,
}: {
  sessionToken: string | null;
}) {
  const [trades, setTrades] = useState<UserTrade[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/trading/history?limit=20", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : { trades: [] }))
      .then((d: any) => {
        if (!cancelled) setTrades(d.trades || []);
      })
      .catch(() => {
        if (!cancelled) setTrades([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="mb-6">
        <h2
          className="text-white font-semibold text-lg mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Recent Trades
        </h2>
        <div
          className="h-24 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-secondary)" }}
        />
      </div>
    );
  }

  if (!trades || trades.length === 0) return null; // zero-state — don't clutter

  return (
    <div className="mb-6">
      <h2
        className="text-white font-semibold text-lg mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Recent Trades
      </h2>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="grid grid-cols-6 gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-wider"
          style={{
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span>Token</span>
          <span className="text-right">Spent</span>
          <span className="text-right">Received</span>
          <span className="text-right">Price</span>
          <span className="text-right">When</span>
          <span className="text-right">Tx</span>
        </div>
        {trades.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-6 gap-2 px-4 py-2.5 text-xs font-mono"
            style={{
              color: "var(--text-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>{t.token_symbol}</span>
            <span className="text-right">${t.spend_usdc.toFixed(2)}</span>
            <span className="text-right">{fmtTokens(t.tokens_received)}</span>
            <span className="text-right">{fmtPrice(t.effective_price)}</span>
            <span className="text-right" style={{ color: "var(--text-muted)" }}>
              {new Date(t.created_at).toLocaleDateString()}
            </span>
            <a
              href={BASESCAN_TX_URL(t.tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-right underline"
              style={{ color: "var(--base-blue)" }}
            >
              {shortHash(t.tx_hash)} ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
