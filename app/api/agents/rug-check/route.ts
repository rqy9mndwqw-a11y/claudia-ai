import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";
import { deductPlatformCredits, addCreditsAtomic, getDB } from "@/lib/marketplace/db";
import { callGroq } from "@/lib/groq";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";
import { resolveTokenDataSource } from "@/lib/data/token-router";

/**
 * POST /api/agents/rug-check — Credit-gated rug-check (in-app counterpart
 * to the x402-gated /api/mini-app/market/rug-check).
 *
 * GET  /api/agents/rug-check?address=0x... — Public read of last cached
 * result, no auth. Powers the shareable /rug-check/[address] page.
 */

const CREDIT_COST = 2;

interface CachedResult {
  kind: "rug-check";
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  liquidity: number;
  buys24h: number;
  sells24h: number;
  analysis: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  // Public read — no auth. Cached results are shareable.
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  try {
    const db = getDB();
    const row = await db
      .prepare(
        "SELECT result_json FROM agent_check_results WHERE kind = 'rug-check' AND token_address = ? ORDER BY id DESC LIMIT 1"
      )
      .bind(address.toLowerCase())
      .first();
    if (row?.result_json) {
      return NextResponse.json({
        cached: true,
        result: JSON.parse(row.result_json as string),
      });
    }
    return NextResponse.json({ cached: false });
  } catch {
    return NextResponse.json({ cached: false });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketplaceAuth(req, {
    ratePrefix: "rug-check",
    rateMax: 10,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;
  const { session, user, db } = auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const query = String((body as any).contract_address || (body as any).symbol || "").trim();
  if (!query || query.length > 100) {
    return NextResponse.json({ error: "contract_address or symbol required" }, { status: 400 });
  }

  if (user.credits < CREDIT_COST) {
    return NextResponse.json(
      {
        error: "Insufficient credits.",
        credits_required: CREDIT_COST,
        credits_current: user.credits,
      },
      { status: 402 }
    );
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  // Route the token — rug-check requires DexScreener data
  const routing = await resolveTokenDataSource(query);
  if (!routing.pair) {
    return NextResponse.json(
      { error: `No DEX pair found for "${query}". Check chain or address.` },
      { status: 404 }
    );
  }

  await deductPlatformCredits(db, session.address, CREDIT_COST, "Rug check");

  try {
    const pair = routing.pair;
    const buys = pair.txns?.h24?.buys ?? 0;
    const sells = pair.txns?.h24?.sells ?? 0;
    const liq = pair.liquidity?.usd ?? 0;
    const ratio = sells > 0 ? (buys / sells).toFixed(2) : "N/A";

    const context = [
      `Token: ${pair.baseToken.name} (${pair.baseToken.symbol})`,
      `Contract: ${pair.baseToken.address}`,
      `Chain: ${(pair as any).chainId || "unknown"}`,
      `Price: $${pair.priceUsd}`,
      `Liquidity: $${liq.toLocaleString()}`,
      `24h Volume: $${(pair.volume?.h24 ?? 0).toLocaleString()}`,
      `Buy/Sell Ratio (24h): ${ratio} (${buys} buys / ${sells} sells)`,
      `1h Change: ${pair.priceChange?.h1 ?? "N/A"}%`,
      `24h Change: ${pair.priceChange?.h24 ?? "N/A"}%`,
    ].join("\n");

    const analysis = await callGroq(
      `${CLAUDIA_VOICE_PROMPT}

You are performing a RUG CHECK on a token.

TOKEN DATA:
${context}

Analyze for red flags:
- Low liquidity (<$10k is dangerous, <$50k is risky)
- Extreme buy/sell imbalance (could indicate wash trading or exit)
- Massive price swings with low volume (manipulation)
- Suspicious transaction patterns

Provide:
1. SAFETY SCORE: X/10 (10 = very safe, 1 = likely rug)
2. RED FLAGS: List specific concerns with numbers
3. GREEN FLAGS: List positive signals
4. VERDICT: Safe / Caution / Danger / Run
5. CLAUDIA TAKE: 1-2 sentences, signature style

Under 200 words. Plain text, no markdown.`,
      groqKey,
      300
    );

    const result: CachedResult = {
      kind: "rug-check",
      token_address: (pair.baseToken.address || "").toLowerCase(),
      token_symbol: pair.baseToken.symbol,
      token_name: pair.baseToken.name,
      chain: (pair as any).chainId || "",
      liquidity: liq,
      buys24h: buys,
      sells24h: sells,
      analysis: analysis || "No analysis generated.",
      created_at: new Date().toISOString(),
    };

    // Cache for public sharing
    try {
      await db
        .prepare(
          `INSERT INTO agent_check_results (kind, token_address, token_symbol, token_name, chain, requester_address, result_json, created_at)
           VALUES ('rug-check', ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(kind, token_address) DO UPDATE SET
             token_symbol = excluded.token_symbol,
             token_name = excluded.token_name,
             chain = excluded.chain,
             requester_address = excluded.requester_address,
             result_json = excluded.result_json,
             created_at = excluded.created_at`
        )
        .bind(
          result.token_address,
          result.token_symbol,
          result.token_name,
          result.chain,
          session.address.toLowerCase(),
          JSON.stringify(result),
          result.created_at
        )
        .run();
    } catch (err) {
      console.error("[rug-check] cache write failed:", (err as Error).message);
    }

    return NextResponse.json({ ...result, credits_charged: CREDIT_COST });
  } catch (err) {
    // Refund on failure
    try {
      await addCreditsAtomic(db, session.address, CREDIT_COST, "refund", `rug-check-fail`);
    } catch {}
    console.error("[rug-check] failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Rug check failed. Credits refunded." },
      { status: 503 }
    );
  }
}
