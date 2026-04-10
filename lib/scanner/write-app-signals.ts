/**
 * Writes top scanner/analysis picks to the app_signals table
 * for the trading bot to consume via D1 polling.
 */

import type { ScanResult } from "./market-scanner";

const SIGNAL_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
const MIN_SCORE = 7.0;

export async function writeAppSignals(
  db: D1Database,
  scanId: string,
  topPicks: ScanResult[],
  source: "scanner" | "full_analysis" = "scanner",
): Promise<number> {
  const now = Date.now();
  const expiresAt = now + SIGNAL_EXPIRY_MS;
  let written = 0;

  const candidates = topPicks.filter(
    (p) => p.score >= MIN_SCORE && (p.rating === "STRONG_BUY" || p.rating === "BUY"),
  );

  for (const pick of candidates) {
    try {
      // Dedup: skip if a pending signal for this pair exists within last 12h
      const existing = await db
        .prepare(
          `SELECT id FROM app_signals
           WHERE pair = ? AND status = 'pending' AND created_at > ?
           LIMIT 1`,
        )
        .bind(pick.ticker, now - 12 * 60 * 60 * 1000)
        .first();

      if (existing) continue;

      await db
        .prepare(
          `INSERT INTO app_signals
           (id, scan_id, symbol, pair, score, rating, reasoning, price_at_signal, rsi, top_signal, source, full_content, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          scanId,
          pick.symbol,
          pick.ticker, // e.g. "SOL/USD"
          pick.score,
          pick.rating,
          pick.reasoning || null,
          pick.price,
          pick.rsi || null,
          pick.topSignal || null,
          source,
          JSON.stringify(pick),
          now,
          expiresAt,
        )
        .run();

      written++;
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "app_signal_write_error",
          pair: pick.ticker,
          error: (err as Error).message,
        }),
      );
    }
  }

  if (written > 0) {
    console.log(
      JSON.stringify({
        event: "app_signals_written",
        count: written,
        source,
        scanId,
      }),
    );
  }

  // Expire old signals
  try {
    await db
      .prepare(
        `UPDATE app_signals SET status = 'expired'
         WHERE status = 'pending' AND expires_at < ?`,
      )
      .bind(now)
      .run();
  } catch {}

  return written;
}
