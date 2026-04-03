import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/health — Health check endpoint
 * Verifies D1 connection and Workers AI binding.
 * Never returns sensitive info.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(`health:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const checks: Record<string, "ok" | "error" | "unavailable"> = {
    status: "ok",
    d1: "unavailable",
    ai: "unavailable",
  };

  // Check D1
  try {
    const { getDB } = await import("@/lib/marketplace/db");
    const db = getDB();
    const result = await db.prepare("SELECT 1 as ping").first();
    checks.d1 = result ? "ok" : "error";
  } catch {
    checks.d1 = "error";
  }

  // Check Workers AI binding exists
  try {
    const { getAI } = await import("@/lib/marketplace/db");
    const ai = getAI();
    checks.ai = ai ? "ok" : "error";
  } catch {
    checks.ai = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  console.log(JSON.stringify({
    event: "health_check",
    checks,
    timestamp: Date.now(),
  }));

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    checks,
    version: "1.0.0",
  }, { status: allOk ? 200 : 503 });
}
