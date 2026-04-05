/**
 * Dynamic Odds — tier-weighted payouts with underdog multipliers.
 */

export const TIER_POWER: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
  oracle: 8,
};

export const BOT_TIER_POWER: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  legendary: 5,
};

export interface BattleOdds {
  fighter1Multiplier: number;
  fighter2Multiplier: number;
  isUpset: boolean;
  upsetMultiplier: number;
}

const UPSET_MULTIPLIERS: Record<number, number> = {
  0: 1, 1: 1, 2: 3, 3: 5, 4: 7, 5: 10, 6: 10, 7: 10,
};

export function calculateOdds(
  fighter1Tier: string,
  fighter2Tier: string,
  fighter1IsHeated: boolean,
  fighter2IsHeated: boolean,
  fighter1WinRate: number,
  fighter2WinRate: number,
): BattleOdds {
  const f1Power = (TIER_POWER[fighter1Tier] ?? 1) * (fighter1IsHeated ? 1.1 : 1) * (1 + fighter1WinRate * 0.5);
  const f2Power = (TIER_POWER[fighter2Tier] ?? 1) * (fighter2IsHeated ? 1.1 : 1) * (1 + fighter2WinRate * 0.5);
  const total = f1Power + f2Power;

  const f1BaseMultiplier = total / f1Power;
  const f2BaseMultiplier = total / f2Power;

  const tierDiff = Math.abs(
    (TIER_POWER[fighter1Tier] ?? 1) - (TIER_POWER[fighter2Tier] ?? 1)
  );
  const isUpset = tierDiff >= 2;
  const upsetMultiplier = UPSET_MULTIPLIERS[Math.min(tierDiff, 7)] ?? 1;

  return {
    fighter1Multiplier: parseFloat(f1BaseMultiplier.toFixed(2)),
    fighter2Multiplier: parseFloat(f2BaseMultiplier.toFixed(2)),
    isUpset,
    upsetMultiplier,
  };
}
