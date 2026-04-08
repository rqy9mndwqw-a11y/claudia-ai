import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndBalance, rateLimit } from "@/lib/auth";
import { scorePoolsWithGroq } from "@/lib/risk-scorer";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const rlError = await rateLimit(req, "risk-scores", 10, 60_000);
    if (rlError) return rlError;

    // Auth + token gate (10K CLAUDIA)
    const session = await requireAuthAndBalance(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json() as any;
    const { pools } = body;

    if (!Array.isArray(pools) || pools.length === 0) {
      return NextResponse.json({ error: "Pools array required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const scores = await scorePoolsWithGroq(pools, apiKey);

    return NextResponse.json({ scores });
  } catch (err) {
    console.error("Risk scoring error:", (err as Error).message);
    return NextResponse.json(
      { error: "Claudia couldn't rate these right now. Try again." },
      { status: 500 }
    );
  }
}
