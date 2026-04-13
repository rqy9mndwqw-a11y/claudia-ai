"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";

/**
 * Shareable rug-check result page. Public — no auth required to view.
 * Reads from cache via GET /api/agents/rug-check?address=<addr>.
 */

interface CachedResult {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  liquidity: number;
  buys24h: number;
  sells24h: number;
  analysis: string;
  created_at: string;
}

function parseScore(analysis: string): number | null {
  const m = analysis.match(/SAFETY SCORE:?\s*(\d+)\s*\/\s*10/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

function parseVerdict(analysis: string): string | null {
  const m = analysis.match(/VERDICT:?\s*(Safe|Caution|Danger|Run)/i);
  return m ? m[1] : null;
}

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 8) return "var(--color-green)";
  if (score >= 5) return "var(--color-amber)";
  if (score >= 3) return "var(--color-orange)";
  return "var(--color-red)";
}

export default function RugCheckResultPage() {
  const params = useParams<{ address: string }>();
  const address = params?.address || "";
  const [result, setResult] = useState<CachedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/agents/rug-check?address=${encodeURIComponent(address)}`)
      .then((r) => r.json() as any)
      .then((data: any) => {
        if (data.cached && data.result) setResult(data.result);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [address]);

  const score = result ? parseScore(result.analysis) : null;
  const verdict = result ? parseVerdict(result.analysis) : null;
  const color = scoreColor(score);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/rug-check"
          className="text-xs font-mono mb-4 inline-block"
          style={{ color: "var(--text-muted)" }}
        >
          ← New check
        </Link>

        {loading && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        )}

        {notFound && !loading && (
          <div
            className="rounded-xl p-6 text-center"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p className="mb-3" style={{ color: "var(--text-primary)" }}>
              No cached rug check for this address yet.
            </p>
            <Link
              href="/rug-check"
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: "var(--color-red)",
                color: "white",
              }}
            >
              Run a new check
            </Link>
          </div>
        )}

        {result && (
          <div
            className="rounded-xl p-6"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {result.token_symbol}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {result.token_name}
                </p>
                <p className="text-xs font-mono mt-1" style={{ color: "var(--text-muted)" }}>
                  {result.chain?.toUpperCase()} · {address.slice(0, 8)}…{address.slice(-6)}
                </p>
              </div>
              {score != null && (
                <div className="text-right">
                  <div className="text-4xl font-bold" style={{ color }}>
                    {score}/10
                  </div>
                  {verdict && (
                    <div
                      className="text-xs font-bold uppercase tracking-wider mt-1"
                      style={{ color }}
                    >
                      {verdict}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="grid grid-cols-3 gap-3 py-3 mb-4 text-xs font-mono"
              style={{
                borderTop: "1px solid var(--border-subtle)",
                borderBottom: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <div style={{ color: "var(--text-muted)" }}>Liquidity</div>
                <div style={{ color: "var(--text-primary)" }}>
                  ${result.liquidity.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)" }}>24h Buys</div>
                <div style={{ color: "var(--color-green)" }}>{result.buys24h}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)" }}>24h Sells</div>
                <div style={{ color: "var(--color-red)" }}>{result.sells24h}</div>
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
              Analyzed {new Date(result.created_at).toLocaleString()} · CLAUDIA heuristic, not financial advice
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/rug-check/${address}`;
                  navigator.clipboard.writeText(url);
                }}
                className="px-3 py-1.5 rounded text-xs font-mono transition-colors hover:opacity-80"
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                }}
              >
                Copy share link
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
