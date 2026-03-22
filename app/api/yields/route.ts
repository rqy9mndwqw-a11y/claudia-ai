import { NextResponse } from "next/server";
import { getYields } from "@/lib/yields-cache";

export async function GET() {
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
