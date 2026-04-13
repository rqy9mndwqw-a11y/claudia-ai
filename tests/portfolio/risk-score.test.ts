import { describe, it, expect } from "vitest";
import {
  computePortfolioRisk,
  bandColorVar,
  bandEmoji,
} from "../../lib/portfolio/risk-score";

describe("computePortfolioRisk", () => {
  it("returns null for empty portfolio", () => {
    expect(computePortfolioRisk([])).toBeNull();
  });

  it("returns null when all balances are zero", () => {
    expect(
      computePortfolioRisk([{ symbol: "ETH", chain: "base", balanceUsd: 0 }])
    ).toBeNull();
  });

  it("all-stable portfolio scores 0 → green", () => {
    const r = computePortfolioRisk([
      { symbol: "USDC", chain: "base", balanceUsd: 500 },
      { symbol: "USDT", chain: "eth", balanceUsd: 500 },
    ]);
    expect(r?.score).toBe(0);
    expect(r?.band).toBe("green");
    expect(r?.stableCoinPct).toBe(100);
  });

  it("all-ETH portfolio: major weight 10 + concentration penalty → ~30", () => {
    // 100% in one non-stable holding triggers the full +20 penalty
    const r = computePortfolioRisk([
      { symbol: "ETH", chain: "base", balanceUsd: 1000 },
    ]);
    expect(r?.score).toBe(30);
    expect(r?.concentrationPenalty).toBe(20);
  });

  it("mixed stable + major: weighted base + small concentration penalty", () => {
    const r = computePortfolioRisk([
      { symbol: "USDC", chain: "base", balanceUsd: 500 },
      { symbol: "ETH", chain: "base", balanceUsd: 500 },
    ]);
    // weighted = 0*0.5 + 10*0.5 = 5
    // largest non-stable = 0.5 > 0.4 → penalty = round(((0.5-0.4)/0.4)*20) = 5
    // total = 10
    expect(r?.score).toBe(10);
    expect(r?.band).toBe("green");
  });

  it("balanced majors (below 40% each) incurs no penalty", () => {
    const r = computePortfolioRisk([
      { symbol: "ETH", chain: "base", balanceUsd: 300 },
      { symbol: "BTC", chain: "eth", balanceUsd: 300 },
      { symbol: "SOL", chain: "base", balanceUsd: 250 },
      { symbol: "AVAX", chain: "avalanche", balanceUsd: 150 },
    ]);
    expect(r?.concentrationPenalty).toBe(0);
    expect(r?.band).toBe("green");
  });

  it("unknown token dominant → high risk", () => {
    const r = computePortfolioRisk([
      { symbol: "TN100X", chain: "base", balanceUsd: 1000 },
    ]);
    // 100% in unknown (80) + full concentration penalty (+20)
    expect(r?.score).toBeGreaterThanOrEqual(75);
    expect(r?.band).toBe("red");
  });

  it("concentration penalty triggers above 40% single holding", () => {
    const r = computePortfolioRisk([
      { symbol: "USDC", chain: "base", balanceUsd: 300 },
      { symbol: "PEPE", chain: "eth", balanceUsd: 700 }, // 70% meme
    ]);
    expect(r?.concentrationPenalty).toBeGreaterThan(0);
    expect(r?.largestHoldingPct).toBe(70);
  });

  it("stables don't trigger concentration penalty", () => {
    const r = computePortfolioRisk([
      { symbol: "USDC", chain: "base", balanceUsd: 900 },
      { symbol: "ETH", chain: "base", balanceUsd: 100 },
    ]);
    expect(r?.concentrationPenalty).toBe(0);
  });

  it("sorts tokens by USD value descending", () => {
    const r = computePortfolioRisk([
      { symbol: "PEPE", chain: "eth", balanceUsd: 100 },
      { symbol: "ETH", chain: "base", balanceUsd: 500 },
      { symbol: "USDC", chain: "base", balanceUsd: 300 },
    ]);
    expect(r?.tokens[0].symbol).toBe("ETH");
    expect(r?.tokens[1].symbol).toBe("USDC");
    expect(r?.tokens[2].symbol).toBe("PEPE");
  });

  it("bandColorVar + bandEmoji return strings for every band", () => {
    for (const band of ["green", "yellow", "orange", "red"] as const) {
      expect(bandColorVar(band)).toBeTruthy();
      expect(bandEmoji(band)).toBeTruthy();
    }
  });

  it("handles bogus balances without throwing", () => {
    const r = computePortfolioRisk([
      { symbol: "ETH", chain: "base", balanceUsd: 100 },
      { symbol: "??", chain: "base", balanceUsd: NaN as any },
      { symbol: "PEPE", chain: "eth", balanceUsd: -5 },
    ]);
    expect(r?.tokens.length).toBe(1);
    expect(r?.tokens[0].symbol).toBe("ETH");
  });
});
