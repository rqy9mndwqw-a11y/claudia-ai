import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(req: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const db = (env as any).DB as D1Database;

    const paperFilter = req.nextUrl.searchParams.get("paper");
    const isPaper = paperFilter !== "0"; // default to paper
    const coinFilter = req.nextUrl.searchParams.get("coin")?.toUpperCase() || null;

    const paperVal = isPaper ? 1 : 0;

    // Build WHERE clauses for optional coin filter
    const coinWhere = coinFilter ? " AND coin LIKE ?" : "";
    const coinBind = coinFilter ? `%${coinFilter}%` : null;

    const [stats, openPositions, recentTrades, strategyStats] =
      await Promise.all([
        coinBind
          ? db.prepare(
              `SELECT
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
                ROUND(SUM(pnl), 2) as total_pnl,
                ROUND(AVG(pnl), 2) as avg_pnl,
                ROUND(AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END), 2) as avg_win,
                ROUND(AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END), 2) as avg_loss,
                COUNT(DISTINCT coin) as unique_coins,
                MIN(COALESCE(entry_time, timestamp)) as first_trade,
                MAX(COALESCE(exit_time, timestamp)) as last_trade
              FROM bot_trades WHERE paper = ? AND pnl IS NOT NULL AND coin LIKE ?`
            ).bind(paperVal, coinBind).first()
          : db.prepare(
              `SELECT
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
                ROUND(SUM(pnl), 2) as total_pnl,
                ROUND(AVG(pnl), 2) as avg_pnl,
                ROUND(AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END), 2) as avg_win,
                ROUND(AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END), 2) as avg_loss,
                COUNT(DISTINCT coin) as unique_coins,
                MIN(COALESCE(entry_time, timestamp)) as first_trade,
                MAX(COALESCE(exit_time, timestamp)) as last_trade
              FROM bot_trades WHERE paper = ? AND pnl IS NOT NULL`
            ).bind(paperVal).first(),

        coinBind
          ? db.prepare(
              `SELECT coin, entry_price, current_price, quantity,
                      stop_loss, status, opened_at,
                      ROUND((COALESCE(current_price, entry_price) - entry_price) / entry_price * 100, 2) as pnl_pct
               FROM bot_positions
               WHERE paper = ? AND status IN ('active', 'open') AND coin LIKE ?
               ORDER BY opened_at DESC LIMIT 20`
            ).bind(paperVal, coinBind).all()
          : db.prepare(
              `SELECT coin, entry_price, current_price, quantity,
                      stop_loss, status, opened_at,
                      ROUND((COALESCE(current_price, entry_price) - entry_price) / entry_price * 100, 2) as pnl_pct
               FROM bot_positions
               WHERE paper = ? AND status IN ('active', 'open')
               ORDER BY opened_at DESC LIMIT 20`
            ).bind(paperVal).all(),

        coinBind
          ? db.prepare(
              `SELECT coin, entry_price, exit_price, pnl, pnl_pct,
                      exit_reason, entry_time, exit_time,
                      CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL
                        THEN ROUND((julianday(exit_time) - julianday(entry_time)) * 24, 1)
                        ELSE NULL END as hold_hours
               FROM bot_trades
               WHERE paper = ? AND pnl IS NOT NULL AND coin LIKE ?
               ORDER BY exit_time DESC LIMIT 20`
            ).bind(paperVal, coinBind).all()
          : db.prepare(
              `SELECT coin, entry_price, exit_price, pnl, pnl_pct,
                      exit_reason, entry_time, exit_time,
                      CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL
                        THEN ROUND((julianday(exit_time) - julianday(entry_time)) * 24, 1)
                        ELSE NULL END as hold_hours
               FROM bot_trades
               WHERE paper = ? AND pnl IS NOT NULL
               ORDER BY exit_time DESC LIMIT 20`
            ).bind(paperVal).all(),

        db
          .prepare(
            `SELECT strategy_name,
                    COUNT(*) as signal_count,
                    ROUND(AVG(confidence), 2) as avg_confidence,
                    SUM(CASE WHEN outcome_pnl > 0 THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN outcome_pnl IS NOT NULL THEN 1 ELSE 0 END) as resolved
             FROM bot_strategy_signals
             GROUP BY strategy_name
             ORDER BY signal_count DESC`
          )
          .all(),
      ]);

    const s = (stats as any) || {};
    const totalTrades = s.total_trades || 0;
    const winRate = totalTrades > 0 ? Math.round(((s.wins || 0) / totalTrades) * 100) : 0;

    return NextResponse.json({
      paper: isPaper,
      coin: coinFilter || "all",
      stats: {
        total_trades: totalTrades,
        wins: s.wins || 0,
        losses: s.losses || 0,
        total_pnl: s.total_pnl || 0,
        avg_pnl: s.avg_pnl || 0,
        avg_win: s.avg_win || 0,
        avg_loss: s.avg_loss || 0,
        unique_coins: s.unique_coins || 0,
        first_trade: s.first_trade || null,
        last_trade: s.last_trade || null,
        win_rate: winRate,
      },
      openPositions: openPositions.results || [],
      recentTrades: recentTrades.results || [],
      strategyStats: strategyStats.results || [],
    });
  } catch (err) {
    console.error("Bot performance API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch bot performance" },
      { status: 500 }
    );
  }
}
