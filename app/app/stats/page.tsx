"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-white font-heading text-2xl mb-2">Platform Stats</h1>
        <p className="text-zinc-500 text-sm mb-8">live data from the CLAUDIA ecosystem</p>

        {/* Holders counter — only shown if data available */}
        {stats?.holders && stats.holders > 0 && (
          <div className="bg-gradient-to-r from-purple-900/30 to-green-900/20 border border-purple-500/20 rounded-2xl p-6 mb-6 text-center">
            <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">
              Token Holders on Base
            </p>
            <p className="text-white font-heading text-5xl">
              {stats.holders.toLocaleString()}
            </p>
            <p className="text-zinc-500 text-xs mt-1">wallets holding $CLAUDIA</p>

            {stats.holdersHistory?.length > 1 && (
              <div className="mt-4 flex items-end gap-0.5 h-10 px-4">
                {stats.holdersHistory.map((day: any, i: number) => {
                  const counts = stats.holdersHistory.map((d: any) => d.holders_count);
                  const max = Math.max(...counts);
                  const min = Math.min(...counts);
                  const pct = max === min ? 50 : ((day.holders_count - min) / (max - min)) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-purple-500/40 hover:bg-purple-500/70 rounded-sm transition-colors cursor-default"
                      style={{ height: `${Math.max(pct, 8)}%` }}
                      title={`${day.recorded_date}: ${day.holders_count.toLocaleString()}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CLAUDIA token — hero card */}
        <div className="bg-surface border border-white/5 rounded-2xl p-5 mb-6">
          <p className="text-zinc-400 text-xs uppercase tracking-wider font-mono mb-3">$CLAUDIA Token</p>
          {loading ? (
            <div className="h-16 bg-white/5 rounded animate-pulse" />
          ) : stats?.claudiaToken ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-white font-heading text-xl font-mono">
                  ${stats.claudiaToken.priceUsd < 0.001
                    ? stats.claudiaToken.priceUsd.toFixed(8)
                    : stats.claudiaToken.priceUsd < 1
                    ? stats.claudiaToken.priceUsd.toFixed(6)
                    : stats.claudiaToken.priceUsd.toFixed(4)}
                </p>
                <p className="text-zinc-500 text-xs">price</p>
              </div>
              <div>
                <p className={`font-heading text-xl ${stats.claudiaToken.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {stats.claudiaToken.priceChange24h >= 0 ? "+" : ""}
                  {stats.claudiaToken.priceChange24h.toFixed(2)}%
                </p>
                <p className="text-zinc-500 text-xs">24h change</p>
              </div>
              <div>
                <p className="text-white font-heading text-xl font-mono">
                  {stats.claudiaToken.volume24h >= 1000
                    ? `$${(stats.claudiaToken.volume24h / 1000).toFixed(1)}K`
                    : `$${stats.claudiaToken.volume24h.toFixed(0)}`}
                </p>
                <p className="text-zinc-500 text-xs">24h volume</p>
              </div>
              <div>
                <p className="text-white font-heading text-xl font-mono">
                  {stats.claudiaToken.liquidity >= 1000
                    ? `$${(stats.claudiaToken.liquidity / 1000).toFixed(1)}K`
                    : `$${stats.claudiaToken.liquidity.toFixed(0)}`}
                </p>
                <p className="text-zinc-500 text-xs">liquidity</p>
              </div>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">token data unavailable</p>
          )}
        </div>

        {/* Platform metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Platform Users", value: stats?.totalUsers, icon: "\uD83D\uDC64" },
            { label: "Active Agents", value: stats?.totalAgents, icon: "\uD83E\uDD16" },
            { label: "Messages Sent", value: stats?.totalMessages, icon: "\uD83D\uDCAC" },
            { label: "Market Mood", value: stats?.marketMood || "\u2014", icon: stats?.marketMood === "bullish" ? "\uD83D\uDFE2" : stats?.marketMood === "bearish" ? "\uD83D\uDD34" : "\uD83D\uDFE1" },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-1">{stat.icon}</p>
              <p className="text-white font-heading text-xl">
                {loading ? (
                  <span className="inline-block w-8 h-5 bg-white/5 rounded animate-pulse" />
                ) : typeof stat.value === "number" ? (
                  stat.value.toLocaleString()
                ) : (
                  stat.value || "\u2014"
                )}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/scanner"
            className="flex-1 bg-surface hover:bg-surface/80 border border-white/10 text-zinc-300 hover:text-white py-3 rounded-2xl text-center transition-all text-sm"
          >
            Market Scanner &rarr;
          </Link>
          <Link
            href="/leaderboard"
            className="flex-1 bg-surface hover:bg-surface/80 border border-white/10 text-zinc-300 hover:text-white py-3 rounded-2xl text-center transition-all text-sm"
          >
            Leaderboard &rarr;
          </Link>
        </div>

        <p className="text-zinc-700 text-xs text-center mt-8">
          CA: 0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B &middot; Base Chain
        </p>
      </div>
    </DashboardLayout>
  );
}
