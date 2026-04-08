import { NextRequest, NextResponse } from "next/server";
import { getDB, getAI, deductPlatformCredits, addCreditsAtomic } from "@/lib/marketplace/db";
import { requireAuth } from "@/lib/auth";
import { runMarketScan } from "@/lib/scanner/market-scanner";
import { postScanToX } from "@/lib/social/post-to-x";
import { getClaudiaHoldersCount } from "@/lib/data/holders";
import { saveAlerts } from "@/lib/scanner/performance-check";
import { writeFeedPost } from "@/lib/feed/post-writer";

const MANUAL_REFRESH_COST = 3;
const MANUAL_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /api/scanner/run
 * Two auth paths:
 * - x-scanner-secret header → cron trigger (no credits)
 * - Bearer token → user manual refresh (3 credits, 10min cooldown)
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scanner-secret");
  const isCron = !!secret;

  const db = getDB();

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }

  if (isCron) {
    // ── Cron path — secret-protected ──
    if (secret !== process.env.SCANNER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lastScan = await db.prepare(
      "SELECT scanned_at FROM market_scans ORDER BY scanned_at DESC LIMIT 1"
    ).first() as any;
    if (lastScan && Date.now() - lastScan.scanned_at < 60_000) {
      return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    }

    try {
      const ai = getAI();
      const { results, summary, topPicks, marketMood } = await runMarketScan(ai, groqKey);

      const scanId = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO market_scans (id, scanned_at, pair_count, results, summary, top_picks, market_mood, trigger_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(scanId, Date.now(), results.length, JSON.stringify(results), summary, JSON.stringify(topPicks), marketMood, "auto").run();

      await db.prepare(
        "DELETE FROM market_scans WHERE id NOT IN (SELECT id FROM market_scans ORDER BY scanned_at DESC LIMIT 24)"
      ).run();

      // X posting disabled — account suspended
      // Still save alerts for performance tracking (without tweet threading)
      try {
        await saveAlerts(db, scanId, null, topPicks);
      } catch (e) {
        console.error("Save alerts failed:", (e as Error).message);
      }

      // Daily holders snapshot — fire and forget
      getClaudiaHoldersCount()
        .then(async (holdersData) => {
          if (!holdersData) return;
          const today = new Date().toISOString().split("T")[0];
          await db
            .prepare(
              `INSERT INTO holders_history (id, holders_count, recorded_at, recorded_date)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(recorded_date) DO UPDATE SET
                 holders_count = excluded.holders_count,
                 recorded_at = excluded.recorded_at`
            )
            .bind(crypto.randomUUID(), holdersData.holdersCount, Date.now(), today)
            .run();
        })
        .catch(() => {}); // never fail the scan

      // Fire-and-forget: post scan to CLAUDIA feed
      const topSymbols = topPicks.slice(0, 3).map((p: any) => p.symbol).join(", ");
      writeFeedPost(db as unknown as D1Database, {
        post_type: "market_scan",
        agent_job: "market_scan",
        title: `Market Scan — ${results.length} pairs`,
        content: summary ? summary.slice(0, 280) : `Scanned ${results.length} pairs. Mood: ${marketMood}. Top picks: ${topSymbols}`,
        full_content: JSON.stringify({ scanId, topPicks: topPicks.slice(0, 5), marketMood }),
        token_symbol: topPicks[0]?.symbol || undefined,
      }).catch(() => {});

      console.log(JSON.stringify({ event: "market_scan_complete", trigger: "cron", pairs: results.length, mood: marketMood, timestamp: Date.now() }));
      return NextResponse.json({ success: true, scanId, pairs: results.length, mood: marketMood });
    } catch (err) {
      console.error("Cron scan failed:", (err as Error).message);
      return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
  } else {
    // ── User manual refresh — session auth + 3 credits ──
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    // Check 10 minute cooldown on manual refreshes (global, not per-user)
    const lastManual = await db.prepare(
      "SELECT scanned_at FROM market_scans WHERE trigger_type = 'manual' ORDER BY scanned_at DESC LIMIT 1"
    ).first() as any;

    if (lastManual) {
      const timeSince = Date.now() - lastManual.scanned_at;
      if (timeSince < MANUAL_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((MANUAL_COOLDOWN_MS - timeSince) / 1000);
        return NextResponse.json({
          error: `Scanner cooling down. Try again in ${waitSeconds} seconds.`,
          cooldownRemaining: waitSeconds,
        }, { status: 429 });
      }
    }

    // Check and deduct credits
    const user = await db.prepare("SELECT credits FROM users WHERE address = ?").bind(session.address.toLowerCase()).first<{ credits: number }>();
    if (!user || user.credits < MANUAL_REFRESH_COST) {
      return NextResponse.json({
        error: "Insufficient credits. Manual refresh costs 3 credits.",
        creditCost: MANUAL_REFRESH_COST,
      }, { status: 402 });
    }

    await deductPlatformCredits(db, session.address, MANUAL_REFRESH_COST, "Scanner manual refresh (3 credits)");

    try {
      const ai = getAI();
      const { results, summary, topPicks, marketMood } = await runMarketScan(ai, groqKey);

      const scanId = crypto.randomUUID();
      await db.prepare(
        `INSERT INTO market_scans (id, scanned_at, pair_count, results, summary, top_picks, market_mood, trigger_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(scanId, Date.now(), results.length, JSON.stringify(results), summary, JSON.stringify(topPicks), marketMood, "manual").run();

      await db.prepare(
        "DELETE FROM market_scans WHERE id NOT IN (SELECT id FROM market_scans ORDER BY scanned_at DESC LIMIT 24)"
      ).run();

      // Fire-and-forget: post scan to CLAUDIA feed
      const manualTopSymbols = topPicks.slice(0, 3).map((p: any) => p.symbol).join(", ");
      writeFeedPost(db as unknown as D1Database, {
        post_type: "market_scan",
        agent_job: "market_scan",
        title: `Market Scan — ${results.length} pairs`,
        content: summary ? summary.slice(0, 280) : `Scanned ${results.length} pairs. Mood: ${marketMood}. Top picks: ${manualTopSymbols}`,
        full_content: JSON.stringify({ scanId, topPicks: topPicks.slice(0, 5), marketMood }),
        token_symbol: topPicks[0]?.symbol || undefined,
      }).catch(() => {});

      console.log(JSON.stringify({ event: "market_scan_complete", trigger: "manual", pairs: results.length, mood: marketMood, timestamp: Date.now() }));
      return NextResponse.json({ success: true, scanId, pairs: results.length, mood: marketMood, creditsCharged: MANUAL_REFRESH_COST });
    } catch (err) {
      try {
        await addCreditsAtomic(db, session.address, MANUAL_REFRESH_COST, "refund", `scan-fail:${Date.now()}`);
      } catch {}
      console.error("Manual scan failed:", (err as Error).message);
      return NextResponse.json({ error: "Scan failed. Credits refunded." }, { status: 500 });
    }
  }
}
