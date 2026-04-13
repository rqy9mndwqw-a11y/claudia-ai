import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * GET /api/bot/health
 *
 * Pipeline heartbeat for the Railway trading bot.
 *
 * Auth: `x-claudia-secret` must match `CLAUDIA_INTERNAL_SECRET` (CF Worker secret).
 * Shared secret with the scanner worker — same as every other bot-origin route.
 *
 * Returns:
 *   status             'ok' | 'stale' | 'empty'
 *   last_signal_at     ISO string from scanner_alerts.created_at
 *   last_trade_at      ISO string from bot_trades (entry_time or exit_time)
 *   signal_count_24h   number of scanner_alerts in the last 24h
 *   trade_count_24h    number of bot_trades in the last 24h
 *   server_time        ISO string (helps detect clock drift on Railway)
 *
 * Bot calls this on startup and on every sync cycle. If status !== 'ok' after
 * a successful write, the bot logs ERROR and the problem becomes visible.
 */

const STALE_SIGNAL_HOURS = 2;  // scanner runs every ~5 min; anything >2h is stale
const STALE_TRADE_HOURS = 24;  // trades are sparser — anything >24h is stale

function hoursBetween(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (isNaN(t)) return Infinity;
  return (now - t) / (1000 * 60 * 60);
}

export async function GET(req: NextRequest) {
  // Shared-secret auth. Public routes on this path would leak activity fingerprints.
  const { env } = getCloudflareContext();
  const expected = (env as any).CLAUDIA_INTERNAL_SECRET as string | undefined;
  const provided = req.headers.get("x-claudia-secret");
  if (!expected) {
    return NextResponse.json(
      { error: "Server not configured (CLAUDIA_INTERNAL_SECRET missing)" },
      { status: 503 }
    );
  }
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = (env as any).DB as D1Database;
  if (!db) {
    return NextResponse.json({ error: "D1 binding missing" }, { status: 503 });
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [lastSignal, lastTrade, signalCount, tradeCount] = await Promise.all([
      db
        .prepare(
          `SELECT created_at FROM scanner_alerts ORDER BY created_at DESC LIMIT 1`
        )
        .first<{ created_at: string }>(),
      db
        .prepare(
          `SELECT COALESCE(exit_time, entry_time, timestamp) AS ts FROM bot_trades
           ORDER BY COALESCE(exit_time, entry_time, timestamp) DESC LIMIT 1`
        )
        .first<{ ts: string }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM scanner_alerts WHERE created_at > ?`
        )
        .bind(dayAgo)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM bot_trades
           WHERE COALESCE(exit_time, entry_time, timestamp) > ?`
        )
        .bind(dayAgo)
        .first<{ n: number }>(),
    ]);

    const last_signal_at = lastSignal?.created_at ?? null;
    const last_trade_at = lastTrade?.ts ?? null;

    // Status derivation:
    //   "empty"  — no data at all
    //   "stale"  — no recent write in the expected window
    //   "ok"     — healthy
    let status: "ok" | "stale" | "empty" = "ok";
    if (!last_signal_at && !last_trade_at) {
      status = "empty";
    } else if (
      (last_signal_at && hoursBetween(last_signal_at, now) > STALE_SIGNAL_HOURS) ||
      (last_trade_at && hoursBetween(last_trade_at, now) > STALE_TRADE_HOURS)
    ) {
      status = "stale";
    }

    return NextResponse.json({
      status,
      last_signal_at,
      last_trade_at,
      signal_count_24h: signalCount?.n ?? 0,
      trade_count_24h: tradeCount?.n ?? 0,
      server_time: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[/api/bot/health] D1 read failed:", (err as Error).message);
    return NextResponse.json(
      { error: "Health read failed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
