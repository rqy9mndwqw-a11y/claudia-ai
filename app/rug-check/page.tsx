"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ConnectGate from "@/components/auth/ConnectGate";
import { useSessionToken } from "@/hooks/useSessionToken";
import { emitPaymentFromHeaders } from "@/components/PaymentToastProvider";

const CREDIT_COST = 2;

function RugCheckContent() {
  const router = useRouter();
  const { sessionToken } = useSessionToken();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!input.trim() || !sessionToken || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/rug-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ contract_address: input.trim() }),
      });
      if (res.ok) emitPaymentFromHeaders(res, "Rug check");
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "Check failed");
        setLoading(false);
        return;
      }
      // Navigate to shareable result page
      if (data.token_address) {
        router.push(`/rug-check/${data.token_address}`);
      } else {
        setError("Check returned no address");
        setLoading(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        Rug Check
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Paste a contract address. CLAUDIA flags red flags, grades safety 1-10, gives a verdict.
        Costs {CREDIT_COST} credits. Results are publicly shareable.
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
          placeholder="0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B"
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
            background: "var(--color-red)",
            color: "white",
          }}
        >
          {loading ? "Scanning…" : `Run Rug Check · ${CREDIT_COST} credits`}
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

      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        CLAUDIA checks liquidity, buy/sell imbalance, volume vs liquidity, and price swings.
        This is a heuristic signal — not a guarantee.
      </div>
    </div>
  );
}

export default function RugCheckPage() {
  return (
    <DashboardLayout>
      <ConnectGate>
        <RugCheckContent />
      </ConnectGate>
    </DashboardLayout>
  );
}
