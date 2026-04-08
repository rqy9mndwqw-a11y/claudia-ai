/**
 * Scanner Alert Performance Checker.
 *
 * Runs on cron — checks alerts that are 24h or 48h old,
 * fetches current price, calculates performance, posts follow-up tweets.
 */

import { getTaapiIndicators } from "@/lib/data/taapi";
import { postReplyToX, type XCredentials } from "@/lib/social/post-to-x";

interface AlertRow {
  id: string;
  tweet_id: string | null;
  symbol: string;
  score: number;
  rating: string;
  price_at_alert: number;
  alerted_at: number;
  checked_24h: number;
  checked_48h: number;
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const ind = await getTaapiIndicators(`${symbol}/USD`, "1d");
    return ind?.candle?.close ?? null;
  } catch {
    return null;
  }
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function buildPerformanceTweet(
  symbol: string,
  score: number,
  priceAtAlert: number,
  currentPrice: number,
  changePct: number,
  hours: 24 | 48
): string {
  const emoji = changePct >= 5 ? "\u{1F680}" // rocket
    : changePct >= 0 ? "\u2705"              // green check
    : changePct >= -5 ? "\u{1F7E1}"         // yellow
    : "\u{1F534}";                           // red

  return [
    `${emoji} ${symbol} ${hours}h update`,
    "",
    `Alert: ${formatPrice(priceAtAlert)} (score ${score}/10)`,
    `Now: ${formatPrice(currentPrice)} (${formatPct(changePct)})`,
    "",
    `${changePct >= 0 ? "Signal confirmed." : "Market moved against."} DYOR.`,
    "",
    "app.claudia.wtf/scanner",
    "$CLAUDIA",
  ].join("\n");
}

export async function checkAlertPerformance(
  db: any,
  credentials: XCredentials
): Promise<{ checked24h: number; checked48h: number; errors: number }> {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  const stats = { checked24h: 0, checked48h: 0, errors: 0 };

  // ── 24h checks: alerts between 23-25h old, not yet checked ──
  const due24h = await db.prepare(
    `SELECT * FROM scanner_alerts
     WHERE checked_24h = 0 AND alerted_at < ? AND alerted_at > ?
     ORDER BY alerted_at ASC LIMIT 10`
  ).bind(now - 23 * HOUR_MS, now - 25 * HOUR_MS).all() as any;

  for (const alert of due24h?.results || []) {
    try {
      const currentPrice = await getCurrentPrice(alert.symbol);
      if (!currentPrice) continue;

      const changePct = ((currentPrice - alert.price_at_alert) / alert.price_at_alert) * 100;

      // Post follow-up tweet as reply to original
      // X reply posting disabled — account suspended
      await db.prepare(
        `UPDATE scanner_alerts
         SET price_24h = ?, change_24h = ?, checked_24h = 1
         WHERE id = ?`
      ).bind(currentPrice, changePct, alert.id).run();

      stats.checked24h++;
    } catch (err) {
      console.error(JSON.stringify({ event: "perf_check_24h_error", symbol: alert.symbol, error: (err as Error).message }));
      stats.errors++;
    }
  }

  // ── 48h checks: alerts between 47-49h old, not yet checked ──
  const due48h = await db.prepare(
    `SELECT * FROM scanner_alerts
     WHERE checked_48h = 0 AND alerted_at < ? AND alerted_at > ?
     ORDER BY alerted_at ASC LIMIT 10`
  ).bind(now - 47 * HOUR_MS, now - 49 * HOUR_MS).all() as any;

  for (const alert of due48h?.results || []) {
    try {
      const currentPrice = await getCurrentPrice(alert.symbol);
      if (!currentPrice) continue;

      const changePct = ((currentPrice - alert.price_at_alert) / alert.price_at_alert) * 100;

      // X reply posting disabled — account suspended
      await db.prepare(
        `UPDATE scanner_alerts
         SET price_48h = ?, change_48h = ?, checked_48h = 1
         WHERE id = ?`
      ).bind(currentPrice, changePct, alert.id).run();

      stats.checked48h++;
    } catch (err) {
      console.error(JSON.stringify({ event: "perf_check_48h_error", symbol: alert.symbol, error: (err as Error).message }));
      stats.errors++;
    }
  }

  // ── Cleanup: delete alerts older than 7 days ──
  await db.prepare(
    "DELETE FROM scanner_alerts WHERE alerted_at < ?"
  ).bind(now - 7 * 24 * HOUR_MS).run();

  console.log(JSON.stringify({ event: "perf_check_complete", ...stats, timestamp: now }));
  return stats;
}

/**
 * Save scanner alerts for top picks (score >= 7) after X post.
 */
export async function saveAlerts(
  db: any,
  scanId: string,
  tweetId: string | null,
  topPicks: Array<{ symbol: string; score: number; rating: string; reasoning: string; price?: number }>
): Promise<number> {
  const alertPicks = topPicks.filter((p) => p.score >= 7 && p.price);
  const now = Date.now();

  for (const pick of alertPicks) {
    await db.prepare(
      `INSERT INTO scanner_alerts (id, scan_id, tweet_id, symbol, score, rating, reasoning, price_at_alert, alerted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      scanId,
      tweetId,
      pick.symbol,
      pick.score,
      pick.rating,
      (pick.reasoning || "").slice(0, 500),
      pick.price!,
      now
    ).run();
  }

  if (alertPicks.length > 0) {
    console.log(JSON.stringify({ event: "scanner_alerts_saved", count: alertPicks.length, scanId }));
  }

  return alertPicks.length;
}
