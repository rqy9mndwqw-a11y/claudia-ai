"use client";

/**
 * TradeButton — canonical entry point to the TradeSignal flow.
 *
 * Handles the common case where the calling surface has a symbol (e.g. "AERO")
 * but not a contract address. Resolves via the token router on click; if the
 * token has no Base DEX pair, displays an inline "not tradable" state instead
 * of opening an unusable dialog.
 *
 * Respects TRADE_EXECUTION_ENABLED — renders nothing when the feature is off.
 */

import { useState } from "react";
import { resolveTokenDataSource } from "@/lib/data/token-router";
import { TRADE_EXECUTION_ENABLED } from "@/lib/trading/config";
import TradeSignal from "./TradeSignal";

type SourcePage =
  | "scanner"
  | "full-analysis"
  | "compare"
  | "watchlist"
  | "feed"
  | "direct";

interface TradeButtonProps {
  /** Token symbol (used if address is not supplied). */
  symbol: string;
  /** Contract address — if known, skips resolution. */
  address?: string | null;
  /** Signal id to attribute the trade to (FK-ish into scanner_alerts). */
  signal_id?: string | null;
  /** Where the button is mounted — used for analytics in user_trades. */
  source_page?: SourcePage;
  /** Override the default button label. */
  label?: string;
  /** Tailwind classes for button styling. Default: solid green. */
  className?: string;
  /** Narrow variant — smaller padding, icon only on very small screens. */
  compact?: boolean;
}

export default function TradeButton({
  symbol,
  address,
  signal_id = null,
  source_page = "direct",
  label,
  className,
  compact,
}: TradeButtonProps) {
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(address || null);
  const [resolvedSymbol, setResolvedSymbol] = useState<string>(symbol);
  const [open, setOpen] = useState(false);
  const [notTradable, setNotTradable] = useState(false);

  if (!TRADE_EXECUTION_ENABLED) return null;

  const handleClick = async () => {
    if (resolving) return;
    setNotTradable(false);

    if (resolvedAddress) {
      setOpen(true);
      return;
    }

    setResolving(true);
    try {
      const r = await resolveTokenDataSource(symbol);
      if (r.token_address && r.has_dex_data) {
        setResolvedAddress(r.token_address);
        if (r.symbol) setResolvedSymbol(r.symbol);
        setOpen(true);
      } else {
        setNotTradable(true);
        // Auto-clear after a few seconds so the user can retry
        setTimeout(() => setNotTradable(false), 4000);
      }
    } catch {
      setNotTradable(true);
      setTimeout(() => setNotTradable(false), 4000);
    } finally {
      setResolving(false);
    }
  };

  const defaultCls = compact
    ? "px-3 py-1.5 rounded-lg text-xs font-bold"
    : "px-4 py-2.5 rounded-lg text-sm font-bold w-full";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={resolving}
        data-testid="trade-signal-button"
        className={`transition-colors disabled:opacity-50 ${className || defaultCls}`}
        style={
          className
            ? undefined
            : {
                background: notTradable ? "var(--bg-primary)" : "var(--color-green)",
                color: notTradable ? "var(--text-muted)" : "black",
                border: notTradable
                  ? "1px solid var(--border-default)"
                  : "1px solid var(--color-green)",
              }
        }
      >
        {resolving
          ? "Finding Base pair…"
          : notTradable
          ? "No DEX pair on Base"
          : label || "Trade this signal"}
      </button>

      {open && resolvedAddress && (
        <TradeSignal
          token_address={resolvedAddress}
          token_symbol={resolvedSymbol}
          signal_id={signal_id}
          source_page={source_page}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
