"use client";

/**
 * Tier widget for the nav header.
 *
 * Shows the user's current discount tier + % inline next to the wallet
 * address. Clicking opens a slide-out with tier details, the next tier's
 * requirements, and a CTA link to buy more $CLAUDIA on Aerodrome.
 *
 * Data source: useAccess() → /api/auth/access (already wired in-app).
 * Tier math: lib/discount-tiers.ts.
 */

import { useState, useMemo, useEffect } from "react";
import { useAccess } from "@/hooks/useAccess";
import {
  DISCOUNT_TIERS,
  getDiscountTier,
  getNextTier,
  tokensToNextTier,
} from "@/lib/discount-tiers";

const AERODROME_LINK =
  "https://aerodrome.finance/swap?from=0x4200000000000000000000000000000000000006&to=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function TierWidget() {
  const { access, loading } = useAccess();
  const [open, setOpen] = useState(false);

  // Memoize tier derivations so they're not recomputed on every render.
  const { tier, next, tokensNeeded } = useMemo(() => {
    const balance = access.claudiaBalance || 0;
    return {
      tier: getDiscountTier(balance),
      next: getNextTier(balance),
      tokensNeeded: tokensToNextTier(balance),
    };
  }, [access.claudiaBalance]);

  // Close slide-out on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (loading || !access.isConnected) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors hover:opacity-90"
        style={{
          background: "color-mix(in srgb, var(--base-blue) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--base-blue) 30%, transparent)",
          color: "var(--base-blue)",
        }}
        aria-expanded={open}
        aria-label={`Current tier: ${tier.label}, ${tier.discountPct}% discount`}
      >
        <span>{tier.label}</span>
        {tier.discountPct > 0 && (
          <span style={{ color: "var(--color-green)" }}>
            −{tier.discountPct}%
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out */}
          <div
            role="dialog"
            aria-label="Tier details"
            className="absolute right-0 top-full mt-2 w-80 rounded-xl p-4 z-50 text-sm"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div
                  className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Your Tier
                </div>
                <div
                  className="text-lg font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {tier.label}
                </div>
                <div
                  className="text-xs font-mono"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatTokens(access.claudiaBalance)} $CLAUDIA
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ color: "var(--text-muted)" }}
              >
                ×
              </button>
            </div>

            <p
              className="text-xs mb-3 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {tier.description}
            </p>

            {next && tokensNeeded > 0 && (
              <div
                className="rounded-lg p-3 mb-3"
                style={{
                  background: "color-mix(in srgb, var(--color-green) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-green) 25%, transparent)",
                }}
              >
                <div
                  className="text-[10px] font-mono uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-green)" }}
                >
                  Next tier: {next.label}
                </div>
                <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                  Hold{" "}
                  <span className="font-bold">{formatTokens(tokensNeeded)}</span>{" "}
                  more $CLAUDIA to reach{" "}
                  <span className="font-bold" style={{ color: "var(--color-green)" }}>
                    −{next.discountPct}% off
                  </span>
                  {next.freeDailyCredits > 0 && (
                    <> + {next.freeDailyCredits} free credits/day</>
                  )}
                  .
                </div>
              </div>
            )}

            {!next && (
              <div
                className="rounded-lg p-3 mb-3 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--color-green) 10%, transparent)",
                  color: "var(--color-green)",
                }}
              >
                You&apos;re at the top tier. Max discounts unlocked.
              </div>
            )}

            {/* Tier ladder */}
            <div
              className="space-y-1.5 pt-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              {DISCOUNT_TIERS.filter((t) => t.key !== "none").map((t) => {
                const isCurrent = t.key === tier.key;
                return (
                  <div
                    key={t.key}
                    className="flex items-center justify-between text-xs font-mono"
                    style={{
                      color: isCurrent ? "var(--text-primary)" : "var(--text-muted)",
                      fontWeight: isCurrent ? 700 : 400,
                    }}
                  >
                    <span>
                      {isCurrent && "▸ "}
                      {t.label}
                    </span>
                    <span className="flex gap-2">
                      <span>{formatTokens(t.minBalance)}</span>
                      {t.discountPct > 0 && (
                        <span style={{ color: "var(--color-green)" }}>
                          −{t.discountPct}%
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <a
              href={AERODROME_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block text-center py-2 rounded-lg text-sm font-bold transition-colors"
              style={{
                background: "var(--base-blue)",
                color: "white",
              }}
            >
              Get $CLAUDIA →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
