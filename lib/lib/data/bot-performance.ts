/**
 * Bot trading performance context for CLAUDIA agents.
 * Queries D1 for historical trade data from the Python trading bot
 * and formats it so agents can learn from past performance.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

// ── Types ──

export interface BotPerformanceContext {
  /** Per-coin stats: trades, wins, losses, P&L */
  coinStats: CoinStat[];
  /** Per-strategy signal accuracy */
  strategyStats: StrategyStat[];
  /** Overall summary numbers */
  summary: BotSummary;
  /** Recent closed positions (last 20) */
  recentPositions: RecentPosition[];
}

interface CoinStat {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgHoldHours: number;
}

interface StrategyStat {
  strategy: string;
  signalCount: number;
  coinsSignaled: number;
  avgConfidence: number;
  /** How many signaled coins had profitable outcomes */
  profitableOutcomes: number;
  outcomeRate: number;
}

interface BotSummary {
  totalTrades: number;
  realTrades: number;
  paperTrades: number;
  uniqueCoins: number;
  totalRealizedPnl: number;
  overallWinRate: number;
  avgPositionSize: number;
  dataRange: string;
}

interface RecentPosition {
  coin: string;
  side: string;
  entryPrice: number;
  exitPnl: number;
  status: string;
  holdHours: number;
  openedAt: string;
}

// ── D1 Queries ──

function getDB(): D1Database {
  const { env } = getCloudflareContext();
  return (env as any).DB as D1Database;
}

/**
 * Fetch bot performance data from D1.
 * Returns null if tables don't exist yet or query fails.
 */
export async function fetchBotPerformance(): Promise<BotPerformanceContext | null> {
  try {
    const db = getDB();

    const [coinStats, strategyStats, summary, recentPositions] = await Promise.all([
      queryCoinStats(db),
      queryStrategyStats(db),
      querySummary(db),
      queryRecentPositions(db),
    ]);

    if (!summary || summary.totalTrades === 0) return null;

    return { coinStats, strategyStats, summary, recentPositions };
  } catch {
    return null;
  }
}

async function queryCoinStats(db: D1Database): Promise<CoinStat[]> {
  // Use synced trades (pnl column) when available, fall back to positions
  const rows = await db
    .prepare(`
      SELECT coin, total_trades, wins, losses, total_pnl, avg_pnl, avg_hold_hours
      FROM (
        -- Synced trades from Railway (preferred — has real PnL)
        SELECT
          coin,
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl <= 0 THEN 1 ELSE 0 END) as losses,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          AVG(
            CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL
            THEN (julianday(exit_time) - julianday(entry_time)) * 24
            ELSE NULL END
          ) as avg_hold_hours
        FROM bot_trades
        WHERE paper = 0 AND pnl IS NOT NULL
        GROUP BY coin

        UNION ALL

        -- Legacy positions (pre-sync migration data)
        SELECT
          p.coin,
          COUNT(*) as total_trades,
          SUM(CASE WHEN p.unrealized_pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN p.unrealized_pnl <= 0 THEN 1 ELSE 0 END) as losses,
          SUM(p.unrealized_pnl) as total_pnl,
          AVG(p.unrealized_pnl) as avg_pnl,
          AVG(
            CASE WHEN p.closed_at IS NOT NULL AND p.opened_at IS NOT NULL
            THEN (julianday(p.closed_at) - julianday(p.opened_at)) * 24
            ELSE NULL END
          ) as avg_hold_hours
        FROM bot_positions p
        WHERE p.status IN ('closed', 'closed_external', 'stopped')
          AND p.paper = 0
          AND p.signal_id NOT IN (SELECT signal_id FROM bot_trades WHERE pnl IS NOT NULL AND paper = 0)
        GROUP BY p.coin
      )
      GROUP BY coin
      ORDER BY total_trades DESC
      LIMIT 20
    `)
    .all();

  return (rows.results || []).map((r: any) => ({
    coin: r.coin,
    totalTrades: r.total_trades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.total_trades > 0 ? (r.wins / r.total_trades) * 100 : 0,
    totalPnl: r.total_pnl || 0,
    avgPnl: r.avg_pnl || 0,
    avgHoldHours: r.avg_hold_hours || 0,
  }));
}

async function queryStrategyStats(db: D1Database): Promise<StrategyStat[]> {
  // Strategy signal stats — use outcome_pnl (synced) or fall back to position cross-ref
  const rows = await db
    .prepare(`
      SELECT
        s.strategy_name,
        COUNT(*) as signal_count,
        COUNT(DISTINCT s.coin) as coins_signaled,
        AVG(s.confidence) as avg_confidence,
        SUM(CASE WHEN s.outcome_pnl > 0 THEN 1
            WHEN s.outcome_pnl IS NULL THEN 0
            ELSE 0 END) as profitable_outcomes,
        SUM(CASE WHEN s.status IN ('won', 'lost') THEN 1 ELSE 0 END) as resolved_count
      FROM bot_strategy_signals s
      GROUP BY s.strategy_name
      ORDER BY signal_count DESC
    `)
    .all();

  return (rows.results || []).map((r: any) => ({
    strategy: r.strategy_name,
    signalCount: r.signal_count,
    coinsSignaled: r.coins_signaled,
    avgConfidence: r.avg_confidence || 0,
    profitableOutcomes: r.profitable_outcomes || 0,
    outcomeRate:
      r.resolved_count > 0
        ? (r.profitable_outcomes / r.resolved_count) * 100
        : r.coins_signaled > 0
          ? (r.profitable_outcomes / r.coins_signaled) * 100
          : 0,
  }));
}

async function querySummary(db: D1Database): Promise<BotSummary> {
  const [tradeStats, syncedPnl, legacyPnl] = await Promise.all([
    db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN paper = 0 THEN 1 ELSE 0 END) as real_trades,
          SUM(CASE WHEN paper = 1 THEN 1 ELSE 0 END) as paper_trades,
          COUNT(DISTINCT coin) as unique_coins,
          AVG(CASE WHEN paper = 0 THEN COALESCE(
            (entry_price * quantity), usd_value
          ) ELSE NULL END) as avg_position_size,
          MIN(COALESCE(entry_time, timestamp)) as first_trade,
          MAX(COALESCE(exit_time, timestamp)) as last_trade
        FROM bot_trades
      `)
      .first<any>(),
    // PnL from synced trades (preferred)
    db
      .prepare(`
        SELECT
          SUM(pnl) as total_pnl,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          COUNT(*) as closed_count
        FROM bot_trades
        WHERE paper = 0 AND pnl IS NOT NULL
      `)
      .first<any>(),
    // PnL from legacy positions (fallback)
    db
      .prepare(`
        SELECT
          SUM(unrealized_pnl) as total_pnl,
          SUM(CASE WHEN unrealized_pnl > 0 THEN 1 ELSE 0 END) as wins,
          COUNT(*) as closed_count
        FROM bot_positions
        WHERE status IN ('closed', 'closed_external', 'stopped')
          AND paper = 0
          AND signal_id NOT IN (SELECT signal_id FROM bot_trades WHERE pnl IS NOT NULL AND paper = 0)
      `)
      .first<any>(),
  ]);

  // Combine synced + legacy PnL
  const totalPnl = (syncedPnl?.total_pnl || 0) + (legacyPnl?.total_pnl || 0);
  const totalWins = (syncedPnl?.wins || 0) + (legacyPnl?.wins || 0);
  const totalClosed = (syncedPnl?.closed_count || 0) + (legacyPnl?.closed_count || 0);

  const first = tradeStats?.first_trade || "";
  const last = tradeStats?.last_trade || "";
  const range = first && last ? `${first.slice(0, 10)} to ${last.slice(0, 10)}` : "N/A";

  return {
    totalTrades: tradeStats?.total || 0,
    realTrades: tradeStats?.real_trades || 0,
    paperTrades: tradeStats?.paper_trades || 0,
    uniqueCoins: tradeStats?.unique_coins || 0,
    totalRealizedPnl: totalPnl,
    overallWinRate: totalClosed > 0 ? (totalWins / totalClosed) * 100 : 0,
    avgPositionSize: tradeStats?.avg_position_size || 0,
    dataRange: range,
  };
}

async function queryRecentPositions(db: D1Database): Promise<RecentPosition[]> {
  // Prefer synced trades (have accurate pnl), fall back to legacy positions
  const rows = await db
    .prepare(`
      SELECT coin, entry_price, pnl as exit_pnl, exit_reason as status,
             entry_time as opened_at, exit_time as closed_at,
             CASE WHEN exit_time IS NOT NULL AND entry_time IS NOT NULL
               THEN (julianday(exit_time) - julianday(entry_time)) * 24
               ELSE 0 END as hold_hours
      FROM bot_trades
      WHERE paper = 0 AND pnl IS NOT NULL
      ORDER BY exit_time DESC
      LIMIT 20
    `)
    .all();

  // If no synced trades yet, fall back to legacy positions
  if (!rows.results || rows.results.length === 0) {
    const legacy = await db
      .prepare(`
        SELECT
          coin, entry_price, unrealized_pnl as exit_pnl, status, opened_at, closed_at,
          CASE WHEN closed_at IS NOT NULL AND opened_at IS NOT NULL
            THEN (julianday(closed_at) - julianday(opened_at)) * 24
            ELSE 0 END as hold_hours
        FROM bot_positions
        WHERE status IN ('closed', 'closed_external', 'stopped')
          AND paper = 0
        ORDER BY closed_at DESC
        LIMIT 20
      `)
      .all();

    return (legacy.results || []).map((r: any) => ({
      coin: r.coin,
      side: "buy",
      entryPrice: r.entry_price,
      exitPnl: r.exit_pnl || 0,
      status: r.status,
      holdHours: Math.round(r.hold_hours || 0),
      openedAt: r.opened_at,
    }));
  }

  return (rows.results || []).map((r: any) => ({
    coin: r.coin,
    side: "buy",
    entryPrice: r.entry_price,
    exitPnl: r.exit_pnl || 0,
    status: r.status,
    holdHours: Math.round(r.hold_hours || 0),
    openedAt: r.opened_at,
  }));
}

// ── Formatting ──

/**
 * Format bot performance data for injection into agent prompts.
 * Only includes relevant coin data when the user's message mentions specific coins.
 */
export function formatBotPerformance(
  data: BotPerformanceContext,
  mentionedCoins?: string[]
): string {
  const lines: string[] = [
    "=== CLAUDIA BOT TRADING HISTORY (real trades, use to inform analysis) ===",
  ];

  // Summary
  const s = data.summary;
  lines.push(
    `Data: ${s.dataRange} | ${s.realTrades} real trades across ${s.uniqueCoins} coins`
  );
  lines.push(
    `P&L: $${s.totalRealizedPnl.toFixed(2)} | Win Rate: ${s.overallWinRate.toFixed(0)}% | Avg Size: $${s.avgPositionSize.toFixed(0)}`
  );

  // Per-coin stats — filter to mentioned coins if provided, otherwise show top performers
  const relevantCoins = mentionedCoins?.length
    ? data.coinStats.filter((c) => {
        const sym = c.coin.split("/")[0].toUpperCase();
        return mentionedCoins.some((m) => m.toUpperCase() === sym);
      })
    : data.coinStats.slice(0, 8);

  if (relevantCoins.length > 0) {
    lines.push("");
    lines.push("COIN PERFORMANCE (real trades):");
    for (const c of relevantCoins) {
      const pnlSign = c.totalPnl >= 0 ? "+" : "";
      lines.push(
        `  ${c.coin}: ${c.totalTrades} trades | ${c.wins}W/${c.losses}L (${c.winRate.toFixed(0)}%) | P&L: ${pnlSign}$${c.totalPnl.toFixed(2)} | Avg hold: ${c.avgHoldHours.toFixed(1)}h`
      );
    }
  }

  // Strategy stats
  if (data.strategyStats.length > 0) {
    lines.push("");
    lines.push("STRATEGY SIGNAL QUALITY:");
    for (const st of data.strategyStats) {
      lines.push(
        `  ${st.strategy}: ${st.signalCount} signals on ${st.coinsSignaled} coins | Avg conf: ${st.avgConfidence.toFixed(2)} | Profitable: ${st.profitableOutcomes}/${st.coinsSignaled} (${st.outcomeRate.toFixed(0)}%)`
      );
    }
  }

  // Recent trades (last 5 for brevity)
  const recent = data.recentPositions.slice(0, 5);
  if (recent.length > 0) {
    lines.push("");
    lines.push("RECENT POSITIONS:");
    for (const p of recent) {
      const pnlSign = p.exitPnl >= 0 ? "+" : "";
      lines.push(
        `  ${p.coin}: entry $${p.entryPrice.toFixed(4)} | ${pnlSign}$${p.exitPnl.toFixed(2)} | ${p.status} after ${p.holdHours}h`
      );
    }
  }

  lines.push("===================================================================");
  return lines.join("\n");
}

/**
 * Fetch and format bot performance for a specific coin query.
 * Returns formatted string or null if no data available.
 */
export async function getBotPerformanceContext(
  userMessage?: string
): Promise<string | null> {
  const data = await fetchBotPerformance();
  if (!data) return null;

  // Extract coin symbols from user message
  const mentionedCoins = userMessage
    ? extractCoinsFromMessage(userMessage)
    : undefined;

  return formatBotPerformance(data, mentionedCoins);
}

/** Simple coin extraction — matches common ticker patterns */
function extractCoinsFromMessage(message: string): string[] {
  const upper = message.toUpperCase();
  // Match $TICKER, TICKER/USD, or standalone known tickers
  const patterns = upper.match(/\$([A-Z]{2,10})\b|([A-Z]{2,10})\/USD/g) || [];
  return patterns.map((p) => p.replace("$", "").replace("/USD", ""));
}
