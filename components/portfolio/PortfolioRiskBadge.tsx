"use client";

/**
 * Portfolio risk badge for the portfolio page header.
 *
 * Computes risk locally from already-loaded token balances (no extra fetch).
 * Badge: "Portfolio Risk: 42/100 🟡"  colored by band (green/yellow/orange/red)
 * Click to expand per-token breakdown — memoized, not recomputed on render.
 */

import { useMemo, useState } from "react";
import {
  computePortfolioRisk,
  bandColorVar,
  bandEmoji,
  type RiskInputToken,
} from "@/lib/portfolio/risk-score";

interface PortfolioRiskBadgeProps {
  tokens: RiskInputToken[];
  /** True while the portfolio is still loading — shows skeleton. */
  loading?: boolean;
}

export default function PortfolioRiskBadge({
  tokens,
  loading,
}: PortfolioRiskBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const risk = useMemo(() => computePortfolioRisk(tokens), [tokens]);

  if (loading) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <span className="inline-block w-2 h-2 rounded-full animate-pulse"
          style={{ background: "var(--text-muted)" }} />
        Analyzing…
      </div>
    );
  }

  if (!risk) return null;

  const color = bandColorVar(risk.band);
  const emoji = bandEmoji(risk.band);

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-colors hover:opacity-90"
        style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
          color,
        }}
        aria-expanded={expanded}
        aria-label={`Portfolio risk ${risk.score} of 100, ${risk.band}`}
      >
        <span style={{ color: "var(--text-secondary)" }}>Portfolio Risk:</span>
        <span className="font-bold">
          {risk.score}/100 {emoji}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            transition: "transform 0.15s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div
          className="mt-2 w-full sm:w-80 rounded-lg p-3 text-xs"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {/* Summary row */}
          <div
            className="grid grid-cols-3 gap-2 mb-3 pb-2"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div>
              <div style={{ color: "var(--text-muted)" }}>Stables</div>
              <div className="font-mono font-bold" style={{ color: "var(--color-green)" }}>
                {risk.stableCoinPct}%
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>Largest</div>
              <div className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                {risk.largestHoldingPct}%
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>Concentration</div>
              <div className="font-mono font-bold" style={{ color: risk.concentrationPenalty > 0 ? color : "var(--text-secondary)" }}>
                +{risk.concentrationPenalty}
              </div>
            </div>
          </div>

          {/* Per-token list (top 10 by USD value) */}
          <div className="space-y-1.5">
            {risk.tokens.slice(0, 10).map((t, i) => (
              <div
                key={`${t.chain}-${t.symbol}-${i}`}
                className="flex items-center justify-between font-mono"
                style={{ color: "var(--text-secondary)" }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span style={{ color: "var(--text-primary)" }}>{t.symbol}</span>
                  <span
                    className="text-[10px] uppercase"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t.chain}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span>{Math.round(t.weight * 100)}%</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      background: `color-mix(in srgb, ${
                        t.risk < 25
                          ? "var(--color-green)"
                          : t.risk < 50
                          ? "var(--color-amber)"
                          : t.risk < 75
                          ? "var(--color-orange)"
                          : "var(--color-red)"
                      } 15%, transparent)`,
                      color:
                        t.risk < 25
                          ? "var(--color-green)"
                          : t.risk < 50
                          ? "var(--color-amber)"
                          : t.risk < 75
                          ? "var(--color-orange)"
                          : "var(--color-red)",
                    }}
                  >
                    {t.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-3 pt-2 text-[10px] leading-relaxed"
            style={{
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            Heuristic score: stables 0, majors 10, blue-chips 25, memes 50,
            unknown 80. Concentration &gt;40% adds a penalty up to +20.
          </div>
        </div>
      )}
    </div>
  );
}
