/**
 * Tests for lib/data/token-router.ts
 *
 * Core invariant: NEVER fall back to BTC (or any unrelated token) when the
 * user asks about a token the system can't find.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DexScreener before importing the router
vi.mock("../../lib/data/dexscreener", () => ({
  searchToken: vi.fn(),
}));

import {
  extractTokenRef,
  resolveTokenDataSource,
  formatDexScreenerContext,
} from "../../lib/data/token-router";
import { searchToken } from "../../lib/data/dexscreener";

const mockedSearchToken = searchToken as unknown as ReturnType<typeof vi.fn>;

describe("extractTokenRef", () => {
  it("extracts contract addresses", () => {
    const addr = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
    expect(extractTokenRef(`analyze ${addr} please`)).toBe(addr);
  });

  it("extracts $-prefixed symbols", () => {
    expect(extractTokenRef("what about $TN100X")).toBe("TN100X");
    expect(extractTokenRef("analyze $claudia")).toBe("CLAUDIA");
  });

  it("extracts TICKER/USD pairs", () => {
    expect(extractTokenRef("show me BTC/USD")).toBe("BTC");
    expect(extractTokenRef("ETH/USDT analysis")).toBe("ETH");
  });

  it("recognizes known CEX symbols without a prefix", () => {
    expect(extractTokenRef("what's ETH doing")).toBe("ETH");
    expect(extractTokenRef("thoughts on SOL")).toBe("SOL");
  });

  it("picks uppercase word as fallback for unknown tokens", () => {
    expect(extractTokenRef("analyze TN100X for me")).toBe("TN100X");
  });

  it("returns null when no token is referenced", () => {
    expect(extractTokenRef("what is DeFi")).toBeNull();
    expect(extractTokenRef("")).toBeNull();
  });

  it("NEVER defaults to BTC", () => {
    // Regression: old extractTickers() returned ["BTC/USD"] for this
    expect(extractTokenRef("")).toBeNull();
    expect(extractTokenRef("tell me about markets")).toBeNull();
  });
});

describe("resolveTokenDataSource", () => {
  beforeEach(() => {
    mockedSearchToken.mockReset();
  });

  it("routes BTC to taapi_cex with no DexScreener call", async () => {
    const result = await resolveTokenDataSource("BTC");
    expect(result.source).toBe("taapi_cex");
    expect(result.symbol).toBe("BTC");
    expect(result.cex_pair).toBe("BTC/USD");
    expect(result.has_cex_data).toBe(true);
    expect(mockedSearchToken).not.toHaveBeenCalled();
  });

  it("routes ETH to taapi_cex", async () => {
    const result = await resolveTokenDataSource("ETH");
    expect(result.source).toBe("taapi_cex");
    expect(result.has_cex_data).toBe(true);
  });

  it("routes unknown symbol (TN100X) to dexscreener when pair exists", async () => {
    mockedSearchToken.mockResolvedValueOnce([
      {
        pairAddress: "0xpair1",
        baseToken: { symbol: "TN100X", name: "TN100X", address: "0xtn100x" },
        quoteToken: { symbol: "WETH" },
        priceUsd: "0.0042",
        priceChange: { h1: 1.2, h6: 3.4, h24: 5.6 },
        volume: { h24: 500_000 },
        liquidity: { usd: 250_000 },
        txns: { h24: { buys: 120, sells: 80 } },
        url: "",
        chainId: "base",
      } as any,
    ]);

    const result = await resolveTokenDataSource("TN100X");
    expect(result.source).toBe("dexscreener");
    expect(result.symbol).toBe("TN100X");
    expect(result.has_cex_data).toBe(false);
    expect(result.has_dex_data).toBe(true);
    expect(result.pair_address).toBe("0xpair1");
  });

  it("picks highest-liquidity pair when multiple match", async () => {
    mockedSearchToken.mockResolvedValueOnce([
      {
        pairAddress: "0xlow",
        baseToken: { symbol: "TN100X", address: "0xtn100x" },
        quoteToken: { symbol: "USDC" },
        priceUsd: "0.0041",
        priceChange: { h24: 0 }, volume: { h24: 100 }, liquidity: { usd: 10_000 },
        txns: { h24: { buys: 0, sells: 0 } }, url: "", chainId: "base",
      } as any,
      {
        pairAddress: "0xhigh",
        baseToken: { symbol: "TN100X", address: "0xtn100x" },
        quoteToken: { symbol: "WETH" },
        priceUsd: "0.0042",
        priceChange: { h24: 0 }, volume: { h24: 1000 }, liquidity: { usd: 500_000 },
        txns: { h24: { buys: 0, sells: 0 } }, url: "", chainId: "base",
      } as any,
    ]);

    const result = await resolveTokenDataSource("TN100X");
    expect(result.pair_address).toBe("0xhigh");
  });

  it("returns source:unknown (not taapi_cex!) when DexScreener has nothing", async () => {
    mockedSearchToken.mockResolvedValueOnce([]);
    const result = await resolveTokenDataSource("DEFINITELYNOTAREALTOKEN");
    expect(result.source).toBe("unknown");
    expect(result.has_cex_data).toBe(false);
    expect(result.has_dex_data).toBe(false);
    // CRITICAL: must NOT have a cex_pair pointing at BTC or anything else
    expect(result.cex_pair).toBeUndefined();
  });

  it("rejects cross-symbol matches (e.g. searching CLAUDIA shouldn't match CLAUDIO)", async () => {
    mockedSearchToken.mockResolvedValueOnce([
      {
        pairAddress: "0xfake",
        baseToken: { symbol: "CLAUDIO", address: "0xclaudio" },
        quoteToken: { symbol: "WETH" },
        priceUsd: "1", priceChange: { h24: 0 }, volume: { h24: 0 },
        liquidity: { usd: 100_000 }, txns: { h24: { buys: 0, sells: 0 } },
        url: "", chainId: "ethereum",
      } as any,
    ]);

    const result = await resolveTokenDataSource("CLAUDIA");
    expect(result.source).toBe("unknown");
    expect(result.has_dex_data).toBe(false);
  });

  it("routes contract address to dexscreener", async () => {
    const addr = "0x98ebd4ac5d4f7022140c51e03cac39d9f94cde9b";
    mockedSearchToken.mockResolvedValueOnce([
      {
        pairAddress: "0xaerodromePool",
        baseToken: { symbol: "CLAUDIA", address: addr },
        quoteToken: { symbol: "WETH" },
        priceUsd: "0.000123", priceChange: { h24: 4.2 },
        volume: { h24: 50_000 }, liquidity: { usd: 150_000 },
        txns: { h24: { buys: 20, sells: 15 } }, url: "", chainId: "base",
      } as any,
    ]);

    const result = await resolveTokenDataSource(addr);
    expect(result.source).toBe("dexscreener");
    expect(result.symbol).toBe("CLAUDIA");
    expect(result.token_address).toBe(addr);
    expect(result.pair_address).toBe("0xaerodromePool");
  });

  it("falls back to on_chain when address has no DEX pair", async () => {
    const addr = "0x1234567890123456789012345678901234567890";
    mockedSearchToken.mockResolvedValueOnce([]);
    const result = await resolveTokenDataSource(addr);
    expect(result.source).toBe("on_chain");
    expect(result.token_address).toBe(addr);
    expect(result.has_cex_data).toBe(false);
  });

  it("never falls back to BTC when the lookup fails (regression)", async () => {
    mockedSearchToken.mockRejectedValueOnce(new Error("network"));
    const result = await resolveTokenDataSource("TN100X");
    expect(result.source).not.toBe("taapi_cex");
    expect(result.cex_pair).not.toBe("BTC/USD");
    expect(result.has_cex_data).toBe(false);
  });
});

describe("formatDexScreenerContext", () => {
  it("renders price, change, volume, liquidity, FDV, buys/sells", () => {
    const pair: any = {
      pairAddress: "0xpair",
      baseToken: { symbol: "TN100X", address: "0xaddr" },
      quoteToken: { symbol: "WETH" },
      priceUsd: "0.0042",
      priceChange: { h1: 1.23, h6: 3.45, h24: 5.67 },
      volume: { h24: 500_000 },
      liquidity: { usd: 250_000 },
      txns: { h24: { buys: 120, sells: 80 } },
      fdv: 42_000_000,
      pairCreatedAt: Date.now() - 7 * 86_400_000,
      chainId: "base",
    };

    const out = formatDexScreenerContext(pair);
    expect(out).toContain("TN100X");
    expect(out).toContain("BASE");
    expect(out).toContain("$0.0042");
    expect(out).toContain("1h +1.23%");
    expect(out).toContain("24h +5.67%");
    expect(out).toContain("Liquidity: $250,000");
    expect(out).toContain("24h Volume: $500,000");
    expect(out).toContain("FDV: $42,000,000");
    expect(out).toContain("24h Buys / Sells: 120 / 80");
    expect(out).toContain("Pair Age: 7 days");
    expect(out).toContain("0xpair");
  });

  it("handles missing fields without crashing", () => {
    const pair: any = {
      pairAddress: "0xpair",
      baseToken: { symbol: "XYZ" },
      quoteToken: { symbol: "WETH" },
      priceUsd: "1",
      priceChange: {},
      volume: {},
      liquidity: {},
      txns: { h24: {} },
    };
    const out = formatDexScreenerContext(pair);
    expect(out).toContain("XYZ");
    expect(out).toContain("?");
  });
});
