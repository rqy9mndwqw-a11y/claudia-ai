"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import ClaudiaCharacter from "@/components/ClaudiaCharacter";
import { useSessionToken } from "@/hooks/useSessionToken";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";
import type { LeaderboardEntry } from "@/lib/leaderboard/calculate";

export default function LeaderboardPage() {
  const { sessionToken } = useSessionToken();
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [myRank, setMyRank] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?month=${selectedMonth}`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  useEffect(() => {
    if (!sessionToken) return;
    fetch("/api/leaderboard/me", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json())
      .then(setMyRank)
      .catch(() => {});
  }, [sessionToken]);

  // Leaderboard launched March 2026 — don't show earlier months
  const LAUNCH_MONTH = "2026-03";
  const months = Array.from({ length: 3 }, (_, i) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() - i; // 0-indexed, handles negative via Date constructor
    const d = new Date(y, m, 1);
    // Format directly from local date — avoid toISOString() UTC shift
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }).filter((m) => m >= LAUNCH_MONTH);

  return (
    <DashboardLayout>
      <TokenGate minBalance={GATE_THRESHOLDS.dashboard}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-start gap-3">
              <ClaudiaCharacter
                imageSrc="/claudia-avatar.png"
                mood="excited"
                size="small"
              />
              <div>
                <h1 className="text-white font-heading text-2xl">
                  Monthly Leaderboard
                </h1>
                <p className="text-zinc-500 text-sm mt-0.5">
                  top 10 get airdropped $CLAUDIA from the community reserve
                </p>
              </div>
            </div>

            {/* Month selector */}
            <div className="flex gap-1">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                    selectedMonth === m
                      ? "bg-accent text-white"
                      : "bg-surface text-zinc-500 hover:text-white"
                  }`}
                >
                  {new Date(parseInt(m.split("-")[0]), parseInt(m.split("-")[1]) - 1, 1).toLocaleDateString("en", {
                    month: "short",
                  })}
                </button>
              ))}
            </div>
          </div>

          {/* Your rank card */}
          {myRank && (
            <div
              className={`rounded-2xl p-5 mb-6 border relative overflow-hidden ${
                myRank.isTop10
                  ? "bg-accent/10 border-accent/30"
                  : myRank.qualified
                  ? "bg-surface border-white/10"
                  : "bg-surface border-white/5"
              }`}
            >
              {myRank.isTop10 && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />
              )}

              <div className="flex items-center justify-between mb-4">
                <p className="text-zinc-400 text-xs uppercase tracking-wider">
                  Your Position
                </p>
                {myRank.isTop10 && (
                  <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full animate-pulse">
                    Airdrop eligible
                  </span>
                )}
                {myRank.qualified && !myRank.isTop10 && (
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">
                    Qualified
                  </span>
                )}
                {!myRank.qualified && (
                  <span className="text-xs bg-white/5 text-zinc-500 border border-white/10 px-3 py-1 rounded-full">
                    Not yet qualified
                  </span>
                )}
              </div>

              {myRank.qualified ? (
                <>
                  <div className="flex items-end gap-4 mb-4">
                    <div>
                      <p className="text-white font-heading text-5xl leading-none">
                        #{myRank.rank}
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        of {myRank.totalParticipants} qualified
                      </p>
                    </div>
                    <div className="flex-1 pb-1">
                      {myRank.rank > 1 &&
                        myRank.entry &&
                        leaderboard?.top10 && (
                          <div>
                            <p className="text-zinc-600 text-xs mb-1">
                              {getPointsToNextRank(myRank, leaderboard)} pts to
                              #{myRank.rank - 1}
                            </p>
                            <div className="w-full bg-white/5 rounded-full h-1">
                              <div
                                className="bg-accent h-1 rounded-full transition-all"
                                style={{
                                  width: `${getProgressPct(myRank, leaderboard)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      {
                        label: "Score",
                        value: myRank.entry?.score?.toLocaleString(),
                      },
                      {
                        label: "Credits Spent",
                        value: myRank.entry?.creditsSpent,
                      },
                      {
                        label: "Purchased",
                        value: myRank.entry?.creditsPurchased,
                      },
                      {
                        label: "Streak",
                        value: `${myRank.entry?.currentStreak}d`,
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-white/[0.03] rounded-xl p-3"
                      >
                        <p className="text-white font-heading text-lg leading-none">
                          {stat.value || "\u2014"}
                        </p>
                        <p className="text-zinc-600 text-xs mt-1">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-zinc-400 text-sm mb-4">
                    meet both requirements to appear on the leaderboard:
                  </p>
                  <div className="space-y-3">
                    <QualificationBar
                      label="Credits spent this month"
                      current={myRank.rawCredits || 0}
                      required={500}
                      unit="credits"
                    />
                    <QualificationBar
                      label="Active days this month"
                      current={myRank.rawActiveDays || 0}
                      required={7}
                      unit="days"
                    />
                  </div>
                  <Link
                    href="/credits"
                    className="mt-4 block text-center text-accent text-sm hover:underline"
                  >
                    buy credits to qualify &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Airdrop prize pool banner */}
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-xs uppercase tracking-wider mb-0.5">
                Monthly Airdrop Pool
              </p>
              <p className="text-white font-heading text-lg">
                $CLAUDIA distributed to top 10
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                snapshot: last day of{" "}
                {new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]) - 1, 1).toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-purple-300 text-xs mb-1">Distribution</p>
              <div className="space-y-0.5">
                {[
                  { place: "1st", pct: "30%" },
                  { place: "2nd", pct: "20%" },
                  { place: "3rd", pct: "15%" },
                  { place: "4-6", pct: "5% ea" },
                  { place: "7-10", pct: "2.5% ea" },
                ].map((d) => (
                  <div
                    key={d.place}
                    className="flex gap-2 text-xs justify-end"
                  >
                    <span className="text-zinc-400">{d.place}</span>
                    <span className="text-white">{d.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leaderboard table */}
          <div className="bg-surface rounded-2xl overflow-hidden border border-white/5 mb-6">
            <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <p className="text-zinc-600 text-xs uppercase tracking-wider w-8">
                Rank
              </p>
              <p className="text-zinc-600 text-xs uppercase tracking-wider">
                User
              </p>
              <p className="text-zinc-600 text-xs uppercase tracking-wider text-right">
                Score
              </p>
            </div>

            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0"
                >
                  <div className="w-8 h-4 bg-white/5 rounded animate-pulse" />
                  <div className="flex-1 h-4 bg-white/5 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
                </div>
              ))
            ) : leaderboard?.top10?.length === 0 ? (
              <div className="py-16 text-center">
                <ClaudiaCharacter
                  imageSrc="/claudia-avatar.png"
                  mood="skeptical"
                  size="small"
                />
                <p className="text-zinc-500 text-sm mt-4">
                  nobody qualified yet this month.
                </p>
                <p className="text-zinc-600 text-xs mt-1">
                  spend 500+ credits and be active 7+ days to appear here.
                </p>
              </div>
            ) : (
              leaderboard?.top10?.map(
                (entry: LeaderboardEntry, i: number) => (
                  <div
                    key={entry.address}
                    className={`grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${
                      i < 3 ? "bg-white/[0.015]" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-8 flex items-center justify-center">
                      {i === 0 ? (
                        <span className="text-xl">&#x1F947;</span>
                      ) : i === 1 ? (
                        <span className="text-xl">&#x1F948;</span>
                      ) : i === 2 ? (
                        <span className="text-xl">&#x1F949;</span>
                      ) : (
                        <span className="text-zinc-500 text-sm font-mono">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        <ClaudiaCharacter
                          imageSrc="/claudia-avatar.png"
                          mood={
                            (entry.avatarPreset as any) || "idle"
                          }
                          size="tiny"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium truncate">
                            {entry.displayName || entry.displayAddress}
                          </p>
                          {entry.xHandle && (
                            <span className="text-zinc-600 text-xs hidden sm:block">
                              @{entry.xHandle}
                            </span>
                          )}
                          {i < 3 && (
                            <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full hidden sm:block">
                              airdrop
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-orange-400 text-xs">
                            {entry.currentStreak}d streak
                          </span>
                          <span className="text-zinc-700 text-xs">
                            &middot;
                          </span>
                          <span className="text-zinc-600 text-xs">
                            {entry.creditsSpent} spent
                          </span>
                          <span className="text-zinc-700 text-xs">
                            &middot;
                          </span>
                          <span className="text-zinc-600 text-xs">
                            {entry.creditsPurchased} bought
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center">
                      <div className="text-right">
                        <p
                          className={`font-heading text-sm ${
                            i === 0
                              ? "text-yellow-400"
                              : i === 1
                              ? "text-zinc-300"
                              : i === 2
                              ? "text-orange-400"
                              : "text-accent"
                          }`}
                        >
                          {entry.score.toLocaleString()}
                        </p>
                        <p className="text-zinc-700 text-xs">pts</p>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>

          {/* Scoring breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-surface rounded-2xl p-5 border border-white/5">
              <p className="text-zinc-400 text-xs uppercase tracking-wider mb-4">
                How scoring works
              </p>
              <div className="space-y-3">
                {[
                  { label: "Each credit spent", pts: "+10 pts" },
                  { label: "Each day active (streak)", pts: "+50 pts/day" },
                  { label: "Each credit purchased", pts: "+5 pts" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-zinc-400 text-sm">{item.label}</span>
                    <span className="text-white text-sm font-medium">
                      {item.pts}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-zinc-600 text-xs">
                    streak resets if you miss a day &middot; snapshot last day of
                    month
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-white/5">
              <p className="text-zinc-400 text-xs uppercase tracking-wider mb-4">
                To qualify
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <div>
                    <p className="text-zinc-300 text-sm">
                      500+ credits spent
                    </p>
                    <p className="text-zinc-600 text-xs">
                      this calendar month
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <div>
                    <p className="text-zinc-300 text-sm">
                      Active on 7+ different days
                    </p>
                    <p className="text-zinc-600 text-xs">
                      any activity counts
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <p className="text-zinc-600 text-xs">
                    casual use doesn&apos;t count. CLAUDIA rewards actual users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Past airdrop history */}
          {leaderboard?.airdropStatus?.distributed && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 mb-6">
              <p className="text-green-400 text-xs uppercase tracking-wider mb-2">
                Airdrop Sent
              </p>
              <p className="text-zinc-300 text-sm">
                {leaderboard.airdropStatus.amount?.toLocaleString()} $CLAUDIA
                distributed to top 10 wallets
              </p>
              {leaderboard.airdropStatus.txHash && (
                <a
                  href={`https://basescan.org/tx/${leaderboard.airdropStatus.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 text-xs mt-1 block hover:underline"
                >
                  View on BaseScan &rarr;
                </a>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-zinc-700 text-xs text-center">
            airdrop reserve: 50,000,000 $CLAUDIA &middot; snapshots taken last
            day of each month &middot; sent within 48 hours
          </p>
        </div>
      </TokenGate>
    </DashboardLayout>
  );
}

function QualificationBar({
  label,
  current,
  required,
  unit,
}: {
  label: string;
  current: number;
  required: number;
  unit: string;
}) {
  const pct = Math.min((current / required) * 100, 100);
  const met = current >= required;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-zinc-400 text-xs">{label}</span>
        <span
          className={`text-xs font-medium ${
            met ? "text-green-400" : "text-zinc-400"
          }`}
        >
          {met ? "\u2713 Met" : `${current} / ${required} ${unit}`}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            met ? "bg-green-400" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getPointsToNextRank(myRank: any, leaderboard: any): number {
  if (!myRank?.rank || myRank.rank <= 1) return 0;
  const nextEntry = leaderboard?.top10?.find(
    (e: any) => e.rank === myRank.rank - 1
  );
  if (!nextEntry || !myRank.entry) return 0;
  return Math.max(0, nextEntry.score - myRank.entry.score + 1);
}

function getProgressPct(myRank: any, leaderboard: any): number {
  if (!myRank?.rank || myRank.rank <= 1) return 100;
  const nextEntry = leaderboard?.top10?.find(
    (e: any) => e.rank === myRank.rank - 1
  );
  const prevEntry = leaderboard?.top10?.find(
    (e: any) => e.rank === myRank.rank + 1
  );
  if (!nextEntry || !myRank.entry) return 50;
  const range = nextEntry.score - (prevEntry?.score || 0);
  const progress = myRank.entry.score - (prevEntry?.score || 0);
  if (range <= 0) return 50;
  return Math.min(Math.max((progress / range) * 100, 5), 95);
}
