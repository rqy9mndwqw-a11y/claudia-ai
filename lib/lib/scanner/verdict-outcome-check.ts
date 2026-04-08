/**
 * Verdict Outcome Checker.
 *
 * Runs on cron — checks verdict predictions that are 24h, 72h, or 7d old,
 * fetches current price, grades the prediction, updates the row.
 * Mirrors the pattern in performance-check.ts.
 */

import { getTaapiIndicators } from "@/lib/data/taapi";

interface OutcomeRow {
  id: string;
  token_symbol: string;
  verdict: string;
  score: number;
  price_at_verdict: number;
  verdict_at: number;
  checked_24h: number;
  checked_72h: number;
  checked_7d: number;
  points_24h: number | null;
  points_72h: number | null;
}

async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const ind = await getTaapiIndicators(`${symbol}/USD`, "1d");
    return ind?.candle?.close ?? null;
  } catch {
    return null;
  }
}

/**
 * Grade a prediction based on verdict type and price change.
 *
 * Buy (score >= 6):  strong_win +3, win +2, neutral 0, loss -1, strong_loss -2
 * Hold (score 4-5):  correct +2, avoided_downside +1, neutral 0, missed_upside -1
 * Avoid (score <= 3): strong_win +3, win +2, neutral 0, slight_miss -1, missed_opportunity -2
 */
function gradePrediction(
  verdict: string,
  changePct: number,
): { grade: string; points: number } {
  const v = verdict.toLowerCase();

  if (v === "buy") {
    if (changePct >= 10) return { grade: "strong_win", points: 3 };
    if (changePct >= 3) return { grade: "win", points: 2 };
    if (changePct >= -3) return { grade: "neutral", points: 0 };
    if (changePct >= -10) return { grade: "loss", points: -1 };
    return { grade: "strong_loss", points: -2 };
  }

  if (v === "hold") {
    if (changePct >= -5 && changePct <= 5) return { grade: "correct", points: 2 };
    if (changePct < -10) return { grade: "avoided_downside", points: 1 };
    if (changePct >= 10) return { grade: "missed_upside", points: -1 };
    return { grade: "neutral", points: 0 };
  }

  // Avoid
  if (changePct < -10) return { grade: "strong_win", points: 3 };
  if (changePct < -3) return { grade: "win", points: 2 };
  if (changePct >= -3 && changePct <= 3) return { grade: "neutral", points: 0 };
  if (changePct >= 10) return { grade: "missed_opportunity", points: -2 };
  return { grade: "slight_miss", points: -1 };
}

export async function checkVerdictOutcomes(
  db: any,
): Promise<{ checked24h: number; checked72h: number; checked7d: number; errors: number }> {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  const stats = { checked24h: 0, checked72h: 0, checked7d: 0, errors: 0 };

  // ── 24h checks: predictions between 23-25h old ──
  const due24h = await db.prepare(
    `SELECT * FROM verdict_outcomes
     WHERE checked_24h = 0 AND verdict_at < ? AND verdict_at > ?
     ORDER BY verdict_at ASC LIMIT 20`
  ).bind(now - 23 * HOUR_MS, now - 25 * HOUR_MS).all() as any;

  for (const row of due24h?.results || []) {
    try {
      const currentPrice = await getCurrentPrice(row.token_symbol);
      if (!currentPrice) continue;

      const changePct = ((currentPrice - row.price_at_verdict) / row.price_at_verdict) * 100;
      const { grade, points } = gradePrediction(row.verdict, changePct);

      await db.prepare(
        `UPDATE verdict_outcomes
         SET price_24h = ?, change_24h = ?, grade_24h = ?, points_24h = ?, checked_24h = 1
         WHERE id = ?`
      ).bind(currentPrice, changePct, grade, points, row.id).run();

      stats.checked24h++;
    } catch (err) {
      console.error(JSON.stringify({ event: "verdict_check_24h_error", symbol: row.token_symbol, error: (err as Error).message }));
      stats.errors++;
    }
  }

  // ── 72h checks: predictions between 71-73h old ──
  const due72h = await db.prepare(
    `SELECT * FROM verdict_outcomes
     WHERE checked_72h = 0 AND verdict_at < ? AND verdict_at > ?
     ORDER BY verdict_at ASC LIMIT 20`
  ).bind(now - 71 * HOUR_MS, now - 73 * HOUR_MS).all() as any;

  for (const row of due72h?.results || []) {
    try {
      const currentPrice = await getCurrentPrice(row.token_symbol);
      if (!currentPrice) continue;

      const changePct = ((currentPrice - row.price_at_verdict) / row.price_at_verdict) * 100;
      const { grade, points } = gradePrediction(row.verdict, changePct);

      await db.prepare(
        `UPDATE verdict_outcomes
         SET price_72h = ?, change_72h = ?, grade_72h = ?, points_72h = ?, checked_72h = 1
         WHERE id = ?`
      ).bind(currentPrice, changePct, grade, points, row.id).run();

      stats.checked72h++;
    } catch (err) {
      console.error(JSON.stringify({ event: "verdict_check_72h_error", symbol: row.token_symbol, error: (err as Error).message }));
      stats.errors++;
    }
  }

  // ── 7d checks: predictions between 167-169h old ──
  const due7d = await db.prepare(
    `SELECT * FROM verdict_outcomes
     WHERE checked_7d = 0 AND verdict_at < ? AND verdict_at > ?
     ORDER BY verdict_at ASC LIMIT 20`
  ).bind(now - 167 * HOUR_MS, now - 169 * HOUR_MS).all() as any;

  for (const row of due7d?.results || []) {
    try {
      const currentPrice = await getCurrentPrice(row.token_symbol);
      if (!currentPrice) continue;

      const changePct = ((currentPrice - row.price_at_verdict) / row.price_at_verdict) * 100;
      const { grade, points } = gradePrediction(row.verdict, changePct);

      // Compute composite: 24h + 72h + 7d*2
      const p24 = row.points_24h ?? 0;
      const p72 = row.points_72h ?? 0;
      const totalPoints = p24 + p72 + (points * 2);
      const finalGrade = totalPoints >= 3 ? "correct" : totalPoints <= -3 ? "incorrect" : "neutral";

      await db.prepare(
        `UPDATE verdict_outcomes
         SET price_7d = ?, change_7d = ?, grade_7d = ?, points_7d = ?, checked_7d = 1,
             total_points = ?, final_grade = ?
         WHERE id = ?`
      ).bind(currentPrice, changePct, grade, points, totalPoints, finalGrade, row.id).run();

      stats.checked7d++;
    } catch (err) {
      console.error(JSON.stringify({ event: "verdict_check_7d_error", symbol: row.token_symbol, error: (err as Error).message }));
      stats.errors++;
    }
  }

  console.log(JSON.stringify({ event: "verdict_outcome_check_complete", ...stats, timestamp: now }));
  return stats;
}

/**
 * Daily aggregation — rolls up graded verdict outcomes into verdict_accuracy_daily.
 * Idempotent: skips if today's date already has rows.
 */
export async function aggregateVerdictAccuracy(db: any): Promise<{ aggregated: boolean }> {
  // Aggregate yesterday's data
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Check if already aggregated
  const existing = await db.prepare(
    "SELECT 1 FROM verdict_accuracy_daily WHERE date = ? LIMIT 1"
  ).bind(dateStr).first();
  if (existing) {
    console.log(JSON.stringify({ event: "verdict_aggregate_skip", date: dateStr, reason: "already_exists" }));
    return { aggregated: false };
  }

  // Get all graded outcomes from yesterday (by verdict_at date)
  const dayStart = new Date(dateStr + "T00:00:00Z").getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const outcomes = await db.prepare(
    `SELECT token_symbol, verdict, score, total_points, final_grade, change_7d, market_regime
     FROM verdict_outcomes
     WHERE final_grade IS NOT NULL AND verdict_at >= ? AND verdict_at < ?`
  ).bind(dayStart, dayEnd).all() as any;

  const rows = outcomes?.results || [];
  if (rows.length === 0) {
    console.log(JSON.stringify({ event: "verdict_aggregate_skip", date: dateStr, reason: "no_data" }));
    return { aggregated: false };
  }

  // Aggregate per verdict type + "all"
  const types = ["Buy", "Hold", "Avoid", "all"];
  for (const vType of types) {
    const filtered = vType === "all" ? rows : rows.filter((r: any) => r.verdict === vType);
    if (filtered.length === 0) continue;

    const correct = filtered.filter((r: any) => r.final_grade === "correct").length;
    const incorrect = filtered.filter((r: any) => r.final_grade === "incorrect").length;
    const neutral = filtered.filter((r: any) => r.final_grade === "neutral").length;
    const avgScore = filtered.reduce((s: number, r: any) => s + r.score, 0) / filtered.length;
    const avgPoints = filtered.reduce((s: number, r: any) => s + (r.total_points || 0), 0) / filtered.length;
    const withChange = filtered.filter((r: any) => r.change_7d != null);
    const avgChange7d = withChange.length > 0
      ? withChange.reduce((s: number, r: any) => s + r.change_7d, 0) / withChange.length
      : null;

    // Best and worst calls
    const sorted = [...filtered].sort((a: any, b: any) => (b.total_points || 0) - (a.total_points || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Dominant market regime
    const regimeCounts: Record<string, number> = {};
    for (const r of filtered) {
      const regime = r.market_regime || "unknown";
      regimeCounts[regime] = (regimeCounts[regime] || 0) + 1;
    }
    const dominantRegime = Object.entries(regimeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

    await db.prepare(
      `INSERT INTO verdict_accuracy_daily
       (date, verdict_type, total_predictions, correct, incorrect, neutral,
        avg_score, avg_points, avg_change_7d, best_call_symbol, best_call_points,
        worst_call_symbol, worst_call_points, market_regime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      dateStr, vType, filtered.length, correct, incorrect, neutral,
      avgScore, avgPoints, avgChange7d, best?.token_symbol || null, best?.total_points || null,
      worst?.token_symbol || null, worst?.total_points || null, dominantRegime,
    ).run();
  }

  console.log(JSON.stringify({ event: "verdict_aggregate_complete", date: dateStr, predictions: rows.length }));
  return { aggregated: true };
}
