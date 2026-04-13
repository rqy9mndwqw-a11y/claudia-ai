import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";
import { deductPlatformCredits, addCreditsAtomic } from "@/lib/marketplace/db";
import {
  TRADE_EXECUTION_ENABLED,
  SLIPPAGE_MIN_PCT,
  SLIPPAGE_MAX_PCT,
  SLIPPAGE_DEFAULT_PCT,
  SPEND_MIN_USDC,
  SPEND_MAX_USDC,
  QUOTE_TTL_SEC,
  TRADE_ROUTING_CREDIT_COST,
  BASE_USDC_ADDRESS,
  BASE_USDC_DECIMALS,
  BASE_CHAIN_ID,
} from "@/lib/trading/config";

/**
 * POST /api/trading/execute
 *
 * Returns an UNSIGNED EIP-1559 transaction for a USDC → token swap on Base via
 * the 0x aggregator. The server NEVER holds private keys — the wallet receives
 * the tx payload and broadcasts it.
 *
 * ──── SECURITY PROPERTIES ────
 *
 * 1. `takerAddress` on the 0x quote is pinned to the authenticated session
 *    wallet. The request body MUST include wallet_address and it MUST equal
 *    session.address (case-insensitive). Any mismatch → 403.
 *
 * 2. The quote is BOUND to that wallet. Another user cannot pick up this
 *    response and broadcast it on their own wallet — 0x signable quotes are
 *    ETH-standard tx calls whose `from` is implicit from the signer, but
 *    some builder paths expect a specific taker; we pin it both ways to
 *    avoid footguns.
 *
 * 3. Slippage is clamped server-side to [SLIPPAGE_MIN_PCT, SLIPPAGE_MAX_PCT].
 *    Spend is clamped to (SPEND_MIN_USDC, SPEND_MAX_USDC].
 *
 * 4. Token address is strictly validated as /^0x[0-9a-fA-F]{40}$/. No symbol
 *    resolution here — that's the caller's job. We never substitute tokens.
 *
 * 5. Feature flag TRADE_EXECUTION_ENABLED gates the entire route. When OFF
 *    the endpoint returns 503 with a plain message.
 *
 * 6. 1 credit is deducted up front. On any error (quote fetch, validation)
 *    the credit is refunded via addCreditsAtomic().
 *
 * ──── RESPONSE SHAPE ────
 *
 * {
 *   venue: 'dex_0x_base',
 *   unsigned_tx: {
 *     to: string,            // Exchange Proxy / router
 *     data: string,          // calldata
 *     value: string,         // usually "0" (USDC is ERC-20, no native value)
 *     gas: string,           // gas limit
 *     maxFeePerGas: string,
 *     maxPriorityFeePerGas: string,
 *     chainId: 8453,
 *   },
 *   allowance_target: string, // USDC.approve(allowance_target, amount) before swap
 *   approve_tx?: {             // present when USDC allowance is insufficient
 *     to: string,              // USDC contract
 *     data: string,            // approve() calldata
 *     value: "0",
 *   },
 *   quote: { buy_amount, buy_token_decimals, price, price_impact_pct,
 *            min_tokens_after_slippage, sources },
 *   expires_at: number,        // unix ms; client MUST re-fetch after
 * }
 */

interface ZeroXQuoteResponse {
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice?: string;
  price: string;
  buyAmount: string;
  sellAmount: string;
  buyTokenAddress: string;
  allowanceTarget: string;
  estimatedPriceImpact?: string;
  sources?: Array<{ name: string; proportion: string }>;
}

function isAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
}

// ERC-20 approve(spender, amount) selector + encoding — no ethers dep needed
const APPROVE_SELECTOR = "0x095ea7b3";
function encodeApprove(spender: string, amountHex: string): string {
  const s = spender.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const a = amountHex.replace(/^0x/, "").padStart(64, "0");
  return APPROVE_SELECTOR + s + a;
}

export async function POST(req: NextRequest) {
  // ── Deploy guard ──
  if (!TRADE_EXECUTION_ENABLED) {
    return NextResponse.json(
      { error: "Trade execution is disabled pending security review" },
      { status: 503 }
    );
  }

  // ── Auth ──
  const auth = await requireMarketplaceAuth(req, {
    ratePrefix: "trading-execute",
    rateMax: 10,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;
  const { session, user, db } = auth;

  // ── Parse + validate body ──
  const body = (await req.json().catch(() => null)) as any;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token_address = String(body.token_address || "").trim();
  const token_symbol = String(body.token_symbol || "").trim().toUpperCase().replace(/^\$/, "");
  const wallet_address = String(body.wallet_address || "").trim();
  const signal_id = body.signal_id ? String(body.signal_id).slice(0, 64) : null;
  const source_page = body.source_page ? String(body.source_page).slice(0, 32) : "direct";

  const spend_usdc = Number(body.spend_usdc);
  let slippage_pct = Number(body.slippage_pct);
  if (!isFinite(slippage_pct)) slippage_pct = SLIPPAGE_DEFAULT_PCT;

  if (!isAddress(token_address)) {
    return NextResponse.json({ error: "token_address must be 0x-prefixed 40-char hex" }, { status: 400 });
  }
  if (!token_symbol || token_symbol.length > 15) {
    return NextResponse.json({ error: "token_symbol required (max 15 chars)" }, { status: 400 });
  }
  if (!isAddress(wallet_address)) {
    return NextResponse.json({ error: "wallet_address must be 0x-prefixed 40-char hex" }, { status: 400 });
  }

  // ── CRITICAL SECURITY CHECK ──
  // The quote's takerAddress is bound to the session wallet. Never accept
  // a body-supplied wallet_address that differs from the authenticated session.
  if (wallet_address.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json(
      { error: "wallet_address must match authenticated session" },
      { status: 403 }
    );
  }

  // Refuse USDC → USDC (would always be a scam or typo)
  if (token_address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase()) {
    return NextResponse.json(
      { error: "Cannot swap USDC for USDC" },
      { status: 400 }
    );
  }

  if (!isFinite(spend_usdc) || spend_usdc < SPEND_MIN_USDC || spend_usdc > SPEND_MAX_USDC) {
    return NextResponse.json(
      { error: `spend_usdc must be in [${SPEND_MIN_USDC}, ${SPEND_MAX_USDC}]` },
      { status: 400 }
    );
  }
  if (slippage_pct < SLIPPAGE_MIN_PCT || slippage_pct > SLIPPAGE_MAX_PCT) {
    return NextResponse.json(
      { error: `slippage_pct must be in [${SLIPPAGE_MIN_PCT}, ${SLIPPAGE_MAX_PCT}]` },
      { status: 400 }
    );
  }

  // ── Credits ──
  if (user.credits < TRADE_ROUTING_CREDIT_COST) {
    return NextResponse.json(
      {
        error: "Insufficient credits for routing",
        credits_required: TRADE_ROUTING_CREDIT_COST,
        credits_current: user.credits,
      },
      { status: 402 }
    );
  }
  await deductPlatformCredits(
    db,
    session.address,
    TRADE_ROUTING_CREDIT_COST,
    `Trade route quote — ${token_symbol}`
  );

  try {
    // ── 0x signable quote ──
    // /swap/v1/quote returns a signable tx (not just a price).
    // takerAddress binds the quote to the session wallet.
    // slippagePercentage is a fraction (0.005 = 0.5%).
    const sellAmount = BigInt(Math.floor(spend_usdc * 10 ** BASE_USDC_DECIMALS)).toString();
    const slippageFraction = (slippage_pct / 100).toString();

    const qs = new URLSearchParams({
      sellToken: BASE_USDC_ADDRESS,
      buyToken: token_address,
      sellAmount,
      takerAddress: wallet_address,
      slippagePercentage: slippageFraction,
      skipValidation: "false",
      intentOnFilling: "false",
    });
    const url = `https://base.api.0x.org/swap/v1/quote?${qs.toString()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    const apiKey = process.env.ZERO_X_API_KEY;
    if (apiKey) headers["0x-api-key"] = apiKey;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // Refund the credit — user didn't get a quote
      await addCreditsAtomic(
        db,
        session.address,
        TRADE_ROUTING_CREDIT_COST,
        "refund",
        "trade-quote-http-fail"
      ).catch(() => {});
      const errorBody = await res.text().catch(() => "");
      console.error("[trading/execute] 0x error", res.status, errorBody.slice(0, 300));
      return NextResponse.json(
        {
          error: `0x quote failed (${res.status})`,
          detail: errorBody.slice(0, 300),
        },
        { status: 502 }
      );
    }

    const quote = (await res.json()) as ZeroXQuoteResponse;

    // Compute post-slippage minimum — we don't trust client-supplied values.
    const buyAmount = BigInt(quote.buyAmount);
    const slippageBps = BigInt(Math.floor(slippage_pct * 100)); // 0.5% → 50 bps
    const minBuyAmount = buyAmount - (buyAmount * slippageBps) / 10_000n;

    // Build the EIP-1559 tx envelope. 0x's /swap returns `gasPrice` (legacy).
    // We translate to maxFeePerGas/maxPriorityFeePerGas for EIP-1559. On Base
    // we set priority to 10% of the gasPrice as a conservative default.
    // Wallets will usually override these anyway.
    const gasPriceWei = BigInt(quote.gasPrice || "0");
    const maxPriorityFeePerGas = (gasPriceWei / 10n).toString();
    const maxFeePerGas = gasPriceWei.toString();

    const unsigned_tx = {
      to: quote.to,
      data: quote.data,
      value: quote.value || "0",
      gas: quote.gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      chainId: BASE_CHAIN_ID,
    };

    // ── Approval helper ──
    // The client must check USDC.allowance(wallet, allowanceTarget) before
    // broadcasting the swap. If insufficient, approve first. We pre-build
    // a max-approval tx payload to make this a 2-click flow.
    const MAX_UINT256_HEX =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const approve_tx = {
      to: BASE_USDC_ADDRESS,
      data: encodeApprove(quote.allowanceTarget, MAX_UINT256_HEX),
      value: "0",
    };

    return NextResponse.json({
      venue: "dex_0x_base",
      unsigned_tx,
      allowance_target: quote.allowanceTarget,
      approve_tx,
      quote: {
        buy_amount: quote.buyAmount,
        sell_amount: quote.sellAmount,
        price: quote.price,
        price_impact_pct: Number(quote.estimatedPriceImpact || 0) * 100,
        min_tokens_after_slippage: minBuyAmount.toString(),
        sources: (quote.sources || [])
          .filter((s) => Number(s.proportion) > 0)
          .map((s) => ({ name: s.name, proportion: Number(s.proportion) })),
        token_address,
        token_symbol,
      },
      signal_id,
      source_page,
      expires_at: Date.now() + QUOTE_TTL_SEC * 1000,
    });
  } catch (err) {
    // Unexpected error — refund
    try {
      await addCreditsAtomic(
        db,
        session.address,
        TRADE_ROUTING_CREDIT_COST,
        "refund",
        "trade-quote-exception"
      );
    } catch {}
    console.error("[trading/execute] unhandled:", (err as Error).message);
    return NextResponse.json(
      { error: "Quote service failed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
