import { NextRequest, NextResponse } from "next/server";
import { getYields } from "@/lib/yields-cache";
import { rateLimit } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Rate limit — public endpoint but prevent scraping abuse
  const rlError = rateLimit(req, "yields", 30, 60_000);
  if (rlError) return rlError;

  try {
    const pools = await getYields();
    return NextResponse.json({ pools, count: pools.length });
  } catch (err) {
    console.error("Yield fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch yield data" },
      { status: 502 }
    );
  }
}
