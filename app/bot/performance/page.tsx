"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/ui/DashboardLayout";

interface Stats {
  total_trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avg_pnl: number;
  avg_win: number;
  avg_loss: number;
  unique_coins: number;
  first_trade: string;
  last_trade: string;
  win_rate: number;
}

interface Position {
  coin: string;
  entry_price: number;
  current_price: number;
  quantity: number;
  stop_loss: number;
  status: string;
  opened_at: string;
  pnl_pct: number;
}

interface Trade {
  coin: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  exit_reason: string;
  entry_time: string;
  exit_time: string;
  hold_hours: number;
}

interface Strategy {
  strategy_name: string;
  signal_count: number;
  avg_confidence: number;
  wins: number;
  resolved: number;
}

interface PerfData {
  paper: boolean;
  stats: Stats;
  openPositions: Position[];
  recentTrades: Trade[];
  strategyStats: Strategy[];
}

export default function BotPerformancePage() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaper, setIsPaper] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/bot/performance?paper=${isPaper ? "1" : "0"}`);
        const d = (await res.json()) as PerfData;
        setData(d);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isPaper]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bot Performance
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Live trading data from CLAUDIA&apos;s automated bot
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPaper(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isPaper
                  ? "bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/30"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}
            >
              Paper
            </button>
            <button
              onClick={() => setIsPaper(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isPaper
                  ? "bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/30"
                  : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
              }`}
            >
              Real
            </button>
          </div>
        </div>

        {/* Coming Soon Banner */}
        {!isPaper && (
          <div className="mb-6 p-4 rounded-lg bg-[#39ff14]/6 border border-[#39ff14]/20">
            <p className="text-[#39ff14] text-sm font-medium">
              Real trading launching after paper testing phase.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-white/40">Loading...</div>
        ) : !data || !data.stats?.total_trades ? (
          <div className="text-center py-20 text-white/40">
            No trading data yet. Bot sync will populate this automatically.
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Trades"
                value={data.stats.total_trades.toString()}
              />
              <StatCard
                label="Win Rate"
                value={`${data.stats.win_rate}%`}
                color={data.stats.win_rate >= 50 ? "green" : "red"}
              />
              <StatCard
                label="Total P&L"
                value={`$${data.stats.total_pnl?.toFixed(2) || "0.00"}`}
                color={(data.stats.total_pnl || 0) >= 0 ? "green" : "red"}
              />
              <StatCard
                label="Coins Traded"
                value={data.stats.unique_coins.toString()}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Avg Win"
                value={`$${data.stats.avg_win?.toFixed(2) || "0.00"}`}
                color="green"
              />
              <StatCard
                label="Avg Loss"
                value={`$${data.stats.avg_loss?.toFixed(2) || "0.00"}`}
                color="red"
              />
              <StatCard
                label="Data Range"
                value={
                  data.stats.first_trade && data.stats.last_trade
                    ? `${data.stats.first_trade.slice(0, 10)} → ${data.stats.last_trade.slice(0, 10)}`
                    : "N/A"
                }
              />
            </div>

            {/* Open Positions */}
            {data.openPositions.length > 0 && (
              <Section title="Open Positions">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10">
                        <th className="text-left py-2 pr-4">Coin</th>
                        <th className="text-right py-2 pr-4">Entry</th>
                        <th className="text-right py-2 pr-4">Current</th>
                        <th className="text-right py-2 pr-4">P&L %</th>
                        <th className="text-right py-2">Opened</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.openPositions.map((p, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5 hover:bg-white/[0.02]"
                        >
                          <td className="py-2 pr-4 text-white font-medium">
                            {p.coin}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/60">
                            ${p.entry_price?.toFixed(4)}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/60">
                            ${p.current_price?.toFixed(4)}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-medium ${
                              (p.pnl_pct || 0) >= 0
                                ? "text-[#39ff14]"
                                : "text-[#ff2244]"
                            }`}
                          >
                            {p.pnl_pct >= 0 ? "+" : ""}
                            {p.pnl_pct?.toFixed(2)}%
                          </td>
                          <td className="py-2 text-right text-white/40">
                            {p.opened_at?.slice(0, 10)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Recent Trades */}
            {data.recentTrades.length > 0 && (
              <Section title="Recent Closed Trades">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10">
                        <th className="text-left py-2 pr-4">Coin</th>
                        <th className="text-right py-2 pr-4">Entry</th>
                        <th className="text-right py-2 pr-4">Exit</th>
                        <th className="text-right py-2 pr-4">P&L</th>
                        <th className="text-right py-2 pr-4">Hold</th>
                        <th className="text-right py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTrades.map((t, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5 hover:bg-white/[0.02]"
                        >
                          <td className="py-2 pr-4 text-white font-medium">
                            {t.coin}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/60">
                            ${t.entry_price?.toFixed(4)}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/60">
                            ${t.exit_price?.toFixed(4)}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-medium ${
                              (t.pnl || 0) >= 0
                                ? "text-[#39ff14]"
                                : "text-[#ff2244]"
                            }`}
                          >
                            ${t.pnl >= 0 ? "+" : ""}
                            {t.pnl?.toFixed(2)}
                          </td>
                          <td className="py-2 pr-4 text-right text-white/40">
                            {t.hold_hours ? `${t.hold_hours}h` : "-"}
                          </td>
                          <td className="py-2 text-right text-white/40 capitalize">
                            {t.exit_reason?.replace("_", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Strategy Breakdown */}
            {data.strategyStats.length > 0 && (
              <Section title="Strategy Breakdown">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.strategyStats.map((s, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <div className="text-white font-medium capitalize mb-2">
                        {s.strategy_name?.replace(/_/g, " ")}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-white/40">Signals</div>
                          <div className="text-white">{s.signal_count}</div>
                        </div>
                        <div>
                          <div className="text-white/40">Confidence</div>
                          <div className="text-white">
                            {s.avg_confidence?.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/40">Accuracy</div>
                          <div className="text-white">
                            {s.resolved > 0
                              ? `${Math.round((s.wins / s.resolved) * 100)}%`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  const colorClass =
    color === "green"
      ? "text-[#39ff14]"
      : color === "red"
        ? "text-[#ff2244]"
        : "text-white";

  return (
    <div className="p-4 rounded-lg bg-[#0d0d0d] border border-white/5">
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-white font-semibold text-lg mb-4">{title}</h2>
      <div className="rounded-lg bg-[#0a0a0a] border border-white/5 p-4">
        {children}
      </div>
    </div>
  );
}
