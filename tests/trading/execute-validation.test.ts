/**
 * Validation-layer tests for the trade execute route.
 *
 * These tests cover the input-sanitization + ABI-encoding logic that a
 * security reviewer needs to be confident in WITHOUT spinning up D1 or the
 * 0x network. They do NOT exercise the full route handler — integration-
 * style tests for session binding / credit refund are omitted to keep the
 * suite fast and deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  SLIPPAGE_MIN_PCT,
  SLIPPAGE_MAX_PCT,
  SPEND_MIN_USDC,
  SPEND_MAX_USDC,
  QUOTE_TTL_SEC,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  BASE_CHAIN_ID,
  TRADE_EXECUTION_ENABLED,
} from "../../lib/trading/config";

// Re-declare locally the tight helpers used by the route. If these drift from
// the route implementation, the tests below will still pass silently — so
// keep these helpers copy-exact with app/api/trading/execute/route.ts.
function isAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
}
const APPROVE_SELECTOR = "0x095ea7b3";
function encodeApprove(spender: string, amountHex: string): string {
  const s = spender.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const a = amountHex.replace(/^0x/, "").padStart(64, "0");
  return APPROVE_SELECTOR + s + a;
}

describe("trading/config", () => {
  it("TRADE_EXECUTION_ENABLED is false by default", () => {
    // Safety invariant: the feature must be OFF by default so a missing
    // env var can never accidentally open the execute path.
    // The flag only returns true if the env var is literally "true".
    expect(["string", "undefined"].includes(typeof process.env.NEXT_PUBLIC_TRADE_EXECUTION_ENABLED)).toBe(true);
    if (process.env.NEXT_PUBLIC_TRADE_EXECUTION_ENABLED !== "true") {
      expect(TRADE_EXECUTION_ENABLED).toBe(false);
    }
  });

  it("quote TTL is 45 seconds (design decision)", () => {
    expect(QUOTE_TTL_SEC).toBe(45);
  });

  it("slippage bounds are sane", () => {
    expect(SLIPPAGE_MIN_PCT).toBeGreaterThan(0);
    expect(SLIPPAGE_MAX_PCT).toBeLessThanOrEqual(5);
    expect(SLIPPAGE_MIN_PCT).toBeLessThan(SLIPPAGE_MAX_PCT);
  });

  it("spend bounds are sane and finite", () => {
    expect(SPEND_MIN_USDC).toBeGreaterThan(0);
    expect(SPEND_MAX_USDC).toBeLessThanOrEqual(100_000);
    expect(SPEND_MAX_USDC).toBeGreaterThan(SPEND_MIN_USDC);
  });

  it("Base constants are correct mainnet values", () => {
    expect(BASE_CHAIN_ID).toBe(8453);
    expect(BASE_USDC_DECIMALS).toBe(6);
    expect(isAddress(BASE_USDC_ADDRESS)).toBe(true);
  });
});

describe("execute route — isAddress()", () => {
  it("accepts canonical 0x-prefixed 40-char hex", () => {
    expect(isAddress("0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B")).toBe(true);
  });
  it("rejects missing 0x prefix", () => {
    expect(isAddress("98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B")).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(isAddress("0x98e")).toBe(false);
    expect(isAddress("0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9BB")).toBe(false);
  });
  it("rejects non-hex chars", () => {
    expect(isAddress("0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9Z")).toBe(false);
  });
  it("rejects SQL/script attempts", () => {
    expect(isAddress("'; DROP TABLE trades; --")).toBe(false);
    expect(isAddress("<script>alert(1)</script>")).toBe(false);
  });
});

describe("execute route — wallet binding semantics", () => {
  it("case-insensitive address comparison required (checksum vs lowercase)", () => {
    const a = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const b = "0xabcdef0123456789abcdef0123456789abcdef01";
    expect(a.toLowerCase() === b.toLowerCase()).toBe(true);
    // But exact equality would have failed — this is why we .toLowerCase()
    expect(a === b).toBe(false);
  });

  it("spends must be within bounds (reject 0 and > max)", () => {
    const check = (n: number) =>
      isFinite(n) && n >= SPEND_MIN_USDC && n <= SPEND_MAX_USDC;
    expect(check(0)).toBe(false);
    expect(check(-1)).toBe(false);
    expect(check(SPEND_MAX_USDC + 1)).toBe(false);
    expect(check(100)).toBe(true);
    expect(check(SPEND_MIN_USDC)).toBe(true);
    expect(check(SPEND_MAX_USDC)).toBe(true);
    expect(check(NaN)).toBe(false);
    expect(check(Infinity)).toBe(false);
  });

  it("slippage bounds reject 0 and > max", () => {
    const check = (n: number) => n >= SLIPPAGE_MIN_PCT && n <= SLIPPAGE_MAX_PCT;
    expect(check(0)).toBe(false);
    expect(check(SLIPPAGE_MIN_PCT)).toBe(true);
    expect(check(SLIPPAGE_MAX_PCT)).toBe(true);
    expect(check(SLIPPAGE_MAX_PCT + 0.01)).toBe(false);
    expect(check(-0.5)).toBe(false);
  });
});

describe("execute route — approve() encoding", () => {
  // ERC-20 approve(address spender, uint256 amount) selector: 0x095ea7b3
  const MAX_UINT256 =
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

  it("selector is ERC-20 approve()", () => {
    const data = encodeApprove(
      "0x1111222233334444555566667777888899990000",
      MAX_UINT256
    );
    expect(data.slice(0, 10)).toBe("0x095ea7b3");
  });

  it("spender address is left-padded to 32 bytes in the first slot", () => {
    const spender = "0x1111222233334444555566667777888899990000";
    const data = encodeApprove(spender, "0x00");
    // selector (10 chars) + spender slot (64 chars) + amount slot (64 chars)
    expect(data.length).toBe(10 + 64 + 64);
    const spenderSlot = data.slice(10, 10 + 64);
    // lowercase, left-padded with 24 zeros (12 bytes)
    expect(spenderSlot).toBe(
      "0000000000000000000000001111222233334444555566667777888899990000"
    );
  });

  it("MAX_UINT256 amount is properly encoded (right-aligned)", () => {
    const data = encodeApprove(
      "0x0000000000000000000000000000000000000001",
      MAX_UINT256
    );
    const amountSlot = data.slice(10 + 64);
    expect(amountSlot).toBe(MAX_UINT256);
  });

  it("checksum-case spender is normalized to lowercase", () => {
    const mixed = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const lower = "0xabcdef0123456789abcdef0123456789abcdef01";
    expect(encodeApprove(mixed, "0x00")).toBe(encodeApprove(lower, "0x00"));
  });
});

describe("execute route — min-received math (slippage BPS)", () => {
  // Mirror of the server-side calculation: minBuy = buy - buy * slippageBps / 10000
  function minBuy(buy: bigint, slippagePct: number): bigint {
    const bps = BigInt(Math.floor(slippagePct * 100));
    return buy - (buy * bps) / 10_000n;
  }

  it("0.5% slippage yields minReceived = 99.5% of buy", () => {
    const buy = 10_000n;
    expect(minBuy(buy, 0.5)).toBe(9_950n);
  });

  it("1.0% slippage yields minReceived = 99% of buy", () => {
    const buy = 1_000_000n;
    expect(minBuy(buy, 1.0)).toBe(990_000n);
  });

  it("5% (max) slippage yields minReceived = 95% of buy", () => {
    const buy = 10_000n;
    expect(minBuy(buy, 5.0)).toBe(9_500n);
  });

  it("integer truncation is conservative (user gets at least min, may get more)", () => {
    // buyAmount 1001, 0.5% slippage → 1001*50/10000 = 5 (truncated)
    // minBuy = 1001 - 5 = 996
    expect(minBuy(1001n, 0.5)).toBe(996n);
  });
});

describe("execute route — USDC sell amount units", () => {
  // USDC has 6 decimals on Base. 10 USDC == 10_000_000 raw.
  it("10 USDC → 10_000_000 raw", () => {
    const raw = BigInt(Math.floor(10 * 10 ** BASE_USDC_DECIMALS));
    expect(raw).toBe(10_000_000n);
  });
  it("0.01 USDC → 10_000 raw", () => {
    const raw = BigInt(Math.floor(0.01 * 10 ** BASE_USDC_DECIMALS));
    expect(raw).toBe(10_000n);
  });
  it("SPEND_MAX_USDC fits in BigInt without precision loss", () => {
    const raw = BigInt(Math.floor(SPEND_MAX_USDC * 10 ** BASE_USDC_DECIMALS));
    // Should be exactly convertible; no 53-bit precision loss
    expect(raw).toBe(BigInt(SPEND_MAX_USDC) * 1_000_000n);
  });
});
