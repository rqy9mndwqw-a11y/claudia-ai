import type { Tier, TierInfo, TelegramUser } from "../types.js";

const TIERS: Array<{ min: number; tier: Tier; limit: number }> = [
  { min: 5_000_000, tier: "unlimited", limit: Infinity },
  { min: 1_000_000, tier: "dashboard", limit: 10 },
  { min: 0, tier: "free", limit: 3 },
];

export function resolveTier(balance: number): { tier: Tier; dailyLimit: number } {
  for (const t of TIERS) {
    if (balance >= t.min) return { tier: t.tier, dailyLimit: t.limit };
  }
  return { tier: "free", dailyLimit: 3 };
}

export function getTierInfo(balance: number, queriesUsed: number): TierInfo {
  const { tier, dailyLimit } = resolveTier(balance);
  return {
    tier,
    balance,
    dailyLimit,
    queriesUsed,
    queriesRemaining: dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - queriesUsed),
  };
}

export function tierLabel(tier: Tier): string {
  switch (tier) {
    case "unlimited": return "Whale (5M+)";
    case "dashboard": return "Dashboard (1M+)";
    default: return "Free";
  }
}
