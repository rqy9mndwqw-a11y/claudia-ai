/**
 * Scanner Cron Worker — triggers market scan every 2 hours.
 * After scan succeeds, triggers X post separately to ensure it fires.
 * Deploy: cd scanner-cron && wrangler deploy
 */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScan(env));
  },

  async fetch(request, env, ctx) {
    ctx.waitUntil(runScan(env));
    return new Response(JSON.stringify({ status: "scan triggered" }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function runScan(env) {
  const baseUrl = "https://app.claudia.wtf";

  try {
    // Step 1: Run the scan
    const scanRes = await fetch(`${baseUrl}/api/scanner/run`, {
      method: "POST",
      headers: {
        "x-scanner-secret": env.SCANNER_SECRET,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(120000),
    });

    const scanData = await scanRes.json();
    console.log("Scan result:", JSON.stringify({
      status: scanRes.status,
      pairs: scanData.pairs || 0,
      mood: scanData.mood || "unknown",
      success: scanData.success || false,
      timestamp: new Date().toISOString(),
    }));

    // Step 2: If scan succeeded, trigger X post separately
    // This ensures the tweet fires even if the main app's fire-and-forget gets cut off
    if (scanData.success) {
      try {
        const xRes = await fetch(`${baseUrl}/api/scanner/test-x`, {
          method: "POST",
          headers: {
            "x-scanner-secret": env.SCANNER_SECRET,
          },
          signal: AbortSignal.timeout(15000),
        });
        const xData = await xRes.json();
        console.log("X post:", JSON.stringify({
          success: xData.success,
          tweetId: xData.tweetId || null,
          error: xData.error || null,
        }));
      } catch (err) {
        console.error("X post failed:", err.message);
      }
    }

    // Step 3: Check performance of past alerts (24h/48h follow-ups)
    try {
      const perfRes = await fetch(`${baseUrl}/api/scanner/performance`, {
        method: "POST",
        headers: {
          "x-scanner-secret": env.SCANNER_SECRET,
        },
        signal: AbortSignal.timeout(30000),
      });
      const perfData = await perfRes.json();
      console.log("Performance check:", JSON.stringify({
        checked24h: perfData.checked24h || 0,
        checked48h: perfData.checked48h || 0,
        errors: perfData.errors || 0,
      }));
    } catch (err) {
      console.error("Performance check failed:", err.message);
    }

    // Step 4: Grade verdict predictions (24h/72h/7d outcome tracking)
    try {
      const verdictRes = await fetch(`${baseUrl}/api/accuracy/check`, {
        method: "POST",
        headers: {
          "x-scanner-secret": env.SCANNER_SECRET,
        },
        signal: AbortSignal.timeout(60000),
      });
      const verdictData = await verdictRes.json();
      console.log("Verdict outcome check:", JSON.stringify({
        checked24h: verdictData.checked24h || 0,
        checked72h: verdictData.checked72h || 0,
        checked7d: verdictData.checked7d || 0,
        errors: verdictData.errors || 0,
      }));
    } catch (err) {
      console.error("Verdict outcome check failed:", err.message);
    }

    // Step 5: Daily accuracy aggregation (idempotent — runs once per day)
    try {
      const aggRes = await fetch(`${baseUrl}/api/accuracy/aggregate`, {
        method: "POST",
        headers: {
          "x-scanner-secret": env.SCANNER_SECRET,
        },
        signal: AbortSignal.timeout(15000),
      });
      const aggData = await aggRes.json();
      console.log("Verdict aggregation:", JSON.stringify({
        aggregated: aggData.aggregated || false,
      }));
    } catch (err) {
      console.error("Verdict aggregation failed:", err.message);
    }
  } catch (err) {
    console.error("Scanner cron error:", err.message);
  }
}
