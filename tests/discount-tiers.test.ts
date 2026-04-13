import { describe, it, expect } from "vitest";
import {
  DISCOUNT_TIERS,
  getDiscountTier,
  getNextTier,
  calculateDiscountedPrice,
  isFreeAccess,
  tokensToNextTier,
} from "../lib/discount-tiers";

describe("discount-tiers", () => {
  it("DISCOUNT_TIERS is sorted ascending by minBalance", () => {
    for (let i = 1; i < DISCOUNT_TIERS.length; i++) {
      expect(DISCOUNT_TIERS[i].minBalance).toBeGreaterThanOrEqual(
        DISCOUNT_TIERS[i - 1].minBalance
      );
    }
  });

  it("zero balance → none tier, no discount", () => {
    const t = getDiscountTier(0);
    expect(t.key).toBe("none");
    expect(t.discountPct).toBe(0);
  });

  it("5M balance → use tier (10% off)", () => {
    const t = getDiscountTier(5_000_000);
    expect(t.key).toBe("use");
    expect(t.discountPct).toBe(10);
  });

  it("25M balance → create tier (25% off)", () => {
    const t = getDiscountTier(25_000_000);
    expect(t.key).toBe("create");
    expect(t.discountPct).toBe(25);
  });

  it("100M balance → whale tier (40% off)", () => {
    const t = getDiscountTier(100_000_000);
    expect(t.key).toBe("whale");
    expect(t.discountPct).toBe(40);
  });

  it("picks the highest qualifying tier", () => {
    // 24.9M → should be "use" (not "create")
    expect(getDiscountTier(24_999_999).key).toBe("use");
    // 25M exactly → "create"
    expect(getDiscountTier(25_000_000).key).toBe("create");
  });

  it("getNextTier returns next up; null at whale", () => {
    expect(getNextTier(0)?.key).toBe("dashboard");
    expect(getNextTier(5_000_000)?.key).toBe("create");
    expect(getNextTier(100_000_000)).toBeNull();
  });

  it("calculateDiscountedPrice applies tier discount", () => {
    const r = calculateDiscountedPrice(10, 25_000_000);
    expect(r.original).toBe(10);
    expect(r.discountPct).toBe(25);
    expect(r.discounted).toBe(7.5);
  });

  it("calculateDiscountedPrice at zero balance = no discount", () => {
    const r = calculateDiscountedPrice(5, 0);
    expect(r.discounted).toBe(5);
    expect(r.discountPct).toBe(0);
  });

  it("isFreeAccess requires creator or higher", () => {
    expect(isFreeAccess(0)).toBe(false);
    expect(isFreeAccess(5_000_000)).toBe(false); // "use" has 0 free daily
    expect(isFreeAccess(25_000_000)).toBe(true); // "create" gets 5 free daily
    expect(isFreeAccess(100_000_000)).toBe(true);
  });

  it("tokensToNextTier returns the gap, 0 at top", () => {
    expect(tokensToNextTier(0)).toBe(1_000_000);
    expect(tokensToNextTier(4_000_000)).toBe(1_000_000);
    expect(tokensToNextTier(100_000_000)).toBe(0);
  });

  it("handles negative or NaN balances safely", () => {
    expect(getDiscountTier(-5).key).toBe("none");
    expect(getDiscountTier(NaN).key).toBe("none");
  });
});
