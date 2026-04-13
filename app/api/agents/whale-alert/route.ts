import { NextRequest, NextResponse } from "next/server";
import { requireMarketplaceAuth } from "@/lib/marketplace/middleware";
import {
  deductPlatformCredits,
  addCreditsAtomic,
  getDB,
} from "@/lib/marketplace/db";
import { callGroq } from "@/lib/groq";
import { CLAUDIA_VOICE_PROMPT } from "@/lib/claudia-voice";
import { searchToken, type TokenPair } from "@/lib/data/dexscreener";

/**
 * POST /api/agents/whale-alert — Credit-gated whale-activity analysis.
 * GET  /api/agents/whale-alert?address=0x... — Public cached read.
 *
 * Uses DexScreener multi-pool data; cross-pool volume imbalance is the
 * primary whale-accumulation signal.
 */

const CREDIT_COST = 3;

interface CachedResult {
  kind: "whale-alert";
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  price: string;
  total_volume: number;
  total_liquidity: number;
  pool_count: number;
  analysis: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  try {
    const db = getDB();
    const row = await db
      .prepare(
        "SELECT result_json FROM agent_check_results WHERE kind = 'whale-alert' AND token_address = ? ORDER BY id DESC LIMIT 1"
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
    ratePrefix: "whale-alert",
    rateMax: 10,
    rateWindowMs: 60_000,
  });
  if (auth instanceof NextResponse) return auth;
  const { session, user, db } = auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const query = String(
    (body as any).contract_address || (body as any).symbol || ""
  ).trim();
  if (!query || query.length > 100) {
    return NextResponse.json(
      { error: "contract_address or symbol required" },
      { status: 400 }
    );
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

  // Whale analysis wants multiple pools, so searchToken (not the router) is
  // the right call here — we want the full pair list, not just the best one.
  const pairs = await searchToken(query).catch(() => [] as TokenPair[]);
  if (!pairs.length) {
    return NextResponse.json(
      { error: `No DEX pairs found for "${query}"` },
      { status: 404 }
    );
  }

  await deductPlatformCredits(db, session.address, CREDIT_COST, "Whale alert");

  try {
    const pair = pairs[0];
    const related = pairs.slice(0, 5);
    const totalVolume = related.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    const totalLiquidity = related.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);

    const poolContext = related
      .map(
        (p, i) =>
          `Pool ${i + 1}: ${p.baseToken.symbol}/${p.quoteToken.symbol} — Vol: $${(
            p.volume?.h24 ?? 0
          ).toLocaleString()} | Liq: $${(p.liquidity?.usd ?? 0).toLocaleString()} | Buys: ${
            p.txns?.h24?.buys ?? 0
          } Sells: ${p.txns?.h24?.sells ?? 0}`
      )
      .join("\n");

    const analysis = await callGroq(
      `${CLAUDIA_VOICE_PROMPT}

You are providing a WHALE ALERT analysis.

TOKEN: ${pair.baseToken.name} (${pair.baseToken.symbol})
Price: $${pair.priceUsd}
Total Volume (all pools): $${totalVolume.toLocaleString()}
Total Liquidity: $${totalLiquidity.toLocaleString()}

POOLS:
${poolContext}

Analyze:
- Volume concentration: is one pool dominating? Whale accumulation signal.
- Buy/sell imbalance across pools: smart money hits the deepest pool.
- Liquidity vs volume ratio: high vol / low liq = possible manipulation.
- Cross-pool arbitrage: price differences = active whales.

Provide:
1. WHALE ACTIVITY: High / Medium / Low
2. ACCUMULATION SIGNAL: Buying / Selling / Neutral
3. KEY OBSERVATIONS: 2-3 bullet points with numbers
4. SMART MONEY VERDICT: What whales are likely doing
5. CLAUDIA TAKE: 2-3 punchy sentences

Under 250 words. Plain text.`,
      groqKey,
      300
    );

    const result: CachedResult = {
      kind: "whale-alert",
      token_address: (pair.baseToken.address || "").toLowerCase(),
      token_symbol: pair.baseToken.symbol,
      token_name: pair.baseToken.name,
      chain: (pair as any).chainId || "",
      price: pair.priceUsd,
      total_volume: totalVolume,
      total_liquidity: totalLiquidity,
      pool_count: related.length,
      analysis: analysis || "No analysis generated.",
      created_at: new Date().toISOString(),
    };

    try {
      await db
        .prepare(
          `INSERT INTO agent_check_results (kind, token_address, token_symbol, token_name, chain, requester_address, result_json, created_at)
           VALUES ('whale-alert', ?, ?, ?, ?, ?, ?, ?)
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
      console.error("[whale-alert] cache write failed:", (err as Error).message);
    }

    return NextResponse.json({ ...result, credits_charged: CREDIT_COST });
  } catch (err) {
    try {
      await addCreditsAtomic(
        db,
        session.address,
        CREDIT_COST,
        "refund",
        "whale-alert-fail"
      );
    } catch {}
    console.error("[whale-alert] failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Whale alert failed. Credits refunded." },
      { status: 503 }
    );
  }
}
