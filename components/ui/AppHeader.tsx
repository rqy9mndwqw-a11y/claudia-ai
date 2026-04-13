"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletConnect from "../WalletConnect";
import BuiltOnBase from "../BuiltOnBase";
import TierWidget from "../TierWidget";
import { useBurnedAmount } from "@/hooks/useBurnedAmount";
import { useSessionToken } from "@/hooks/useSessionToken";

/**
 * Top bar — ecosystem links (left), burn tracker (center), wallet (right).
 * Sits above content area, to the right of sidebar on desktop.
 */

const ECOSYSTEM_LINKS = [
  {
    label: "CHART",
    href: "https://dexscreener.com/base/0xe6be7cc04136ddada378175311fbd6424409f997",
  },
  {
    label: "AERODROME",
    href: "https://aerodrome.finance/swap?inputCurrency=ETH&outputCurrency=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B",
  },
  {
    label: "UNISWAP",
    href: "https://app.uniswap.org/explore/tokens/base/0x98ebd4ac5d4f7022140c51e03cac39d9f94cde9b",
  },
  {
    label: "X / TWITTER",
    href: "https://x.com/Claudiadev_wtf",
  },
];

export default function AppHeader() {
  const pathname = usePathname();
  const { burned } = useBurnedAmount();
  const { sessionToken } = useSessionToken();
  const [streak, setStreak] = useState(0);

  // Breadcrumb from pathname
  const breadcrumb = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/[[\]]/g, "").toUpperCase())
    .join(" // ") || "DASHBOARD";

  useEffect(() => {
    if (!sessionToken) return;
    fetch("/api/leaderboard/me", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json())
      .then((data: any) => setStreak(data.entry?.currentStreak || 0))
      .catch(() => {});
  }, [sessionToken]);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 border-b border-white/5 bg-bg/80 backdrop-blur-md gap-3">
      {/* Left — breadcrumb + Base badge */}
      <div className="hidden md:flex items-center gap-3">
        <BuiltOnBase variant="inline" />
        <span className="text-[10px] font-mono tracking-widest" style={{ color: "var(--text-muted)" }}>
          APP // {breadcrumb}
        </span>
      </div>

      {/* Center — golden burn tracker */}
      <div className="flex-1 flex justify-center">
        {burned != null && burned > 0 && (
          <div className="relative flex items-center gap-2 px-4 py-1 rounded-lg">
            <div className="absolute inset-0 bg-amber-500/[0.04] rounded-lg" />
            <span className="relative text-[10px] font-mono tracking-wide bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent">
              TOTAL BURNED: {burned.toLocaleString()} $CLAUDIA
            </span>
            <span className="relative animate-burn-gold text-sm">&#x1F525;</span>
          </div>
        )}
      </div>

      {/* Right — status LED + streak + wallet */}
      <div className="flex items-center gap-2.5">
        <span className="hidden lg:flex items-center gap-1.5 text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-green)" }} />
          ONLINE
        </span>
        {streak > 0 && (
          <span
            className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg"
            title={`${streak} day streak`}
          >
            {streak}d
          </span>
        )}
        <Link
          href="/profile"
          className="hidden sm:flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          title="Profile"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </svg>
        </Link>
        <TierWidget />
        <WalletConnect />
      </div>
    </header>
  );
}
