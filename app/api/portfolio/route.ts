import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";
import { fetchPortfolio } from "@/lib/portfolio/fetch-portfolio";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const url = new URL(req.url);
    const address = url.searchParams.get("address") || session.address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const portfolio = await fetchPortfolio(address);

    // Save daily snapshot — fire and forget
    const db = getDB();
    const today = new Date().toISOString().split("T")[0];
    db.prepare(
      `INSERT INTO portfolio_snapshots (id, address, total_value_usd, token_count, snapshot_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(address, snapshot_date) DO UPDATE SET
         total_value_usd = excluded.total_value_usd,
         token_count = excluded.token_count`
    )
      .bind(crypto.randomUUID(), address.toLowerCase(), portfolio.totalValueUsd, portfolio.tokens.length, today, Date.now())
      .run()
      .catch(() => {});

    return NextResponse.json(portfolio, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("Portfolio error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
