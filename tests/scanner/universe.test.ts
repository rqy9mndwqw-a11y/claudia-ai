import { describe, it, expect } from "vitest";
import {
  assembleUniverse,
  type ScanTarget,
} from "../../lib/scanner/universe";

// Pure tests on the assembly logic. HTTP fetchers are tested indirectly
// through production runs — mocking CF `caches` + `global.fetch` together
// was too flaky to be worthwhile.

function t(
  partial: Partial<ScanTarget> & { symbol: string; source: ScanTarget["source"]; tier: ScanTarget["tier"] }
): ScanTarget {
  return {
    address: null,
    chain: null,
    ...partial,
  };
}

describe("assembleUniverse", () => {
  it("merges multiple sources into a single list", () => {
    const r = assembleUniverse([
      [t({ symbol: "BTC", source: "top50", tier: 1 })],
      [t({ symbol: "AERO", source: "base_trending", tier: 2, address: "0xaero", chain: "base" })],
      [t({ symbol: "NEW", source: "launch", tier: 3, address: "0xnew", chain: "base" })],
    ]);
    expect(r.targets.length).toBe(3);
    expect(r.targets.map((x) => x.symbol)).toEqual(["BTC", "AERO", "NEW"]);
  });

  it("dedupes by address — first occurrence wins", () => {
    const r = assembleUniverse([
      [t({ symbol: "SAME", source: "watchlist", tier: 1, address: "0xshared" })],
      [t({ symbol: "SAME", source: "base_trending", tier: 2, address: "0xshared" })],
    ]);
    const matches = r.targets.filter((x) => x.address === "0xshared");
    expect(matches.length).toBe(1);
    expect(matches[0].source).toBe("watchlist"); // first source wins
    expect(matches[0].tier).toBe(1);
    expect(r.dedupedCount).toBe(1);
  });

  it("dedupes by symbol when address is null", () => {
    const r = assembleUniverse([
      [t({ symbol: "BTC", source: "top50", tier: 1 })],
      [t({ symbol: "BTC", source: "gainer_24h", tier: 2 })],
    ]);
    expect(r.targets.length).toBe(1);
    expect(r.targets[0].source).toBe("top50");
    expect(r.dedupedCount).toBe(1);
  });

  it("different addresses with same symbol are NOT deduped", () => {
    const r = assembleUniverse([
      [t({ symbol: "X", source: "base_trending", tier: 2, address: "0xa" })],
      [t({ symbol: "X", source: "watchlist", tier: 1, address: "0xb" })],
    ]);
    expect(r.targets.length).toBe(2);
  });

  it("reorders output by tier: tier 1 → tier 2 → tier 3", () => {
    const r = assembleUniverse([
      [t({ symbol: "L", source: "launch", tier: 3, address: "0xl" })],
      [t({ symbol: "T", source: "base_trending", tier: 2, address: "0xt" })],
      [t({ symbol: "W", source: "watchlist", tier: 1, address: "0xw" })],
    ]);
    expect(r.targets.map((x) => x.tier)).toEqual([1, 2, 3]);
  });

  it("caps at maxTargets, preserving tier priority", () => {
    const src: ScanTarget[] = [];
    for (let i = 0; i < 20; i++) {
      src.push(t({ symbol: `T3_${i}`, source: "launch", tier: 3, address: `0xc${i}` }));
    }
    for (let i = 0; i < 20; i++) {
      src.push(t({ symbol: `T1_${i}`, source: "top50", tier: 1 }));
    }
    const r = assembleUniverse([src], 5);
    expect(r.targets.length).toBe(5);
    // Every one of the top 5 should be tier 1 (T1_...)
    for (const x of r.targets) expect(x.tier).toBe(1);
  });

  it("source counts reflect unique accepted targets only", () => {
    const r = assembleUniverse([
      [
        t({ symbol: "SAME", source: "watchlist", tier: 1, address: "0xs" }),
        t({ symbol: "SAME", source: "watchlist", tier: 1, address: "0xs" }), // dup
        t({ symbol: "BTC", source: "top50", tier: 1 }),
      ],
    ]);
    expect(r.sourceCounts.watchlist).toBe(1);
    expect(r.sourceCounts.top50).toBe(1);
    expect(r.dedupedCount).toBe(1);
  });

  it("skips entries with no address AND no symbol", () => {
    const r = assembleUniverse([
      [
        t({ symbol: "", source: "top50", tier: 1 }),
        t({ symbol: "REAL", source: "top50", tier: 1 }),
      ],
    ]);
    expect(r.targets.length).toBe(1);
    expect(r.targets[0].symbol).toBe("REAL");
  });

  it("empty sources → empty result, zero counts", () => {
    const r = assembleUniverse([]);
    expect(r.targets).toEqual([]);
    expect(r.dedupedCount).toBe(0);
    expect(Object.values(r.sourceCounts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
