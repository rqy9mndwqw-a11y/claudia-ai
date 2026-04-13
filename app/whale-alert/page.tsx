"use client";

import { useState } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ConnectGate from "@/components/auth/ConnectGate";
import { useSessionToken } from "@/hooks/useSessionToken";
import { emitPaymentFromHeaders } from "@/components/PaymentToastProvider";

const CREDIT_COST = 3;

interface WhaleResult {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  price: string;
  total_volume: number;
  total_liquidity: number;
  pool_count: number;
  analysis: string;
  created_at: string;
}

function WhaleAlertContent() {
  const { sessionToken } = useSessionToken();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!input.trim() || !sessionToken || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/whale-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ contract_address: input.trim() }),
      });
      if (res.ok) emitPaymentFromHeaders(res, "Whale alert");
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "Alert failed");
      } else {
        setResult(data as WhaleResult);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Whale Alert
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Multi-pool volume analysis — spot accumulation before the chart does.
        Costs {CREDIT_COST} credits.
      </p>

      <div
        className="rounded-xl p-4 mb-4"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <label
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Contract address or symbol
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="0x940181a94A35A4569E4529A3CDfB74e38FD98631 or AERO"
          className="w-full mt-2 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none"
          style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={run}
          disabled={loading || !input.trim() || !sessionToken}
          className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
          style={{
            background: "var(--base-blue)",
            color: "white",
          }}
        >
          {loading ? "Scanning pools…" : `Run Whale Alert · ${CREDIT_COST} credits`}
        </button>
      </div>

      {error && (
        <div
          className="text-sm p-3 rounded-lg mb-4"
          style={{
            color: "var(--color-red)",
            background: "color-mix(in srgb, var(--color-red) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-red) 30%, transparent)",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          className="rounded-xl p-6 mt-6"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {result.token_symbol}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {result.token_name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
                ${result.price}
              </div>
              <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {result.pool_count} pools
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-3 py-3 mb-4 text-xs font-mono"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <div>
              <div style={{ color: "var(--text-muted)" }}>24h Volume</div>
              <div style={{ color: "var(--text-primary)" }}>
                ${result.total_volume.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>Liquidity</div>
              <div style={{ color: "var(--text-primary)" }}>
                ${result.total_liquidity.toLocaleString()}
              </div>
            </div>
          </div>

          <pre
            className="text-sm whitespace-pre-wrap font-mono leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          >
            {result.analysis}
          </pre>

          <div
            className="mt-4 pt-3 text-xs font-mono"
            style={{
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {new Date(result.created_at).toLocaleString()} · heuristic, not financial advice
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhaleAlertPage() {
  return (
    <DashboardLayout>
      <ConnectGate>
        <WhaleAlertContent />
      </ConnectGate>
    </DashboardLayout>
  );
}
