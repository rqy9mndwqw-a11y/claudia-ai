import { describe, it, expect } from "vitest";
import {
  summarizeQuotes,
  type VenueQuote,
} from "../../lib/trading/route-scanner";

function q(p: Partial<VenueQuote>): VenueQuote {
  return {
    venue: "0x_base",
    venue_label: "Base DEX (0x)",
    price_usd: 0,
    price_impact_pct: 0,
    fee_pct: 0,
    gas_estimate_usd: 0,
    total_cost_usd: 100,
    effective_price: 0,
    tokens_out: 0,
    available: true,
    ...p,
  };
}

describe("route-scanner / summarizeQuotes", () => {
  it("null best when no venues are available", () => {
    const r = summarizeQuotes([
      q({ venue: "0x_base", available: false }),
      q({ venue: "kraken", available: false }),
    ]);
    expect(r.best).toBeNull();
    expect(r.savings_vs_worst_pct).toBe(0);
  });

  it("picks the lowest effective_price as best", () => {
    const r = summarizeQuotes([
      q({ venue: "0x_base", venue_label: "0x", effective_price: 1.0 }),
      q({ venue: "kraken", venue_label: "Kraken", effective_price: 1.05 }),
      q({ venue: "aerodrome", venue_label: "Aerodrome", effective_price: 1.1 }),
    ]);
    expect(r.best?.venue).toBe("0x_base");
  });

  it("computes savings_vs_worst correctly", () => {
    const r = summarizeQuotes([
      q({ effective_price: 1.0 }),
      q({ venue: "kraken", effective_price: 1.1 }),
    ]);
    // best=1.0, worst=1.1 → (1.1 - 1.0)/1.1 * 100 ≈ 9.09%
    expect(r.savings_vs_worst_pct).toBeCloseTo(9.09, 1);
  });

  it("savings is 0 when there's only one available quote", () => {
    const r = summarizeQuotes([
      q({ effective_price: 1.0 }),
      q({ venue: "kraken", available: false }),
    ]);
    expect(r.best?.venue).toBe("0x_base");
    expect(r.savings_vs_worst_pct).toBe(0);
  });

  it("filters out Infinity effective_price entries", () => {
    const r = summarizeQuotes([
      q({ effective_price: 1.0 }),
      q({ venue: "kraken", effective_price: Infinity }),
    ]);
    expect(r.best?.venue).toBe("0x_base");
    expect(r.savings_vs_worst_pct).toBe(0);
  });

  it("keeps unavailable quotes in the output (for UI display)", () => {
    const r = summarizeQuotes([
      q({ effective_price: 1.0 }),
      q({ venue: "kraken", available: false, error: "not listed" }),
    ]);
    // Both quotes surface to the UI even though Kraken is unavailable
    expect(r.quotes.length).toBe(2);
    expect(r.quotes.find((x) => x.venue === "kraken")?.available).toBe(false);
  });

  it("equal prices across venues → 0 savings", () => {
    const r = summarizeQuotes([
      q({ effective_price: 1.0 }),
      q({ venue: "kraken", effective_price: 1.0 }),
    ]);
    expect(r.savings_vs_worst_pct).toBe(0);
  });
});
