import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.CLAUDIA_GROUP_CHAT_ID || "";

  if (!botToken || !chatId) {
    return NextResponse.json({ error: "Telegram credentials not configured" }, { status: 503 });
  }

  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;
    const today = new Date().toISOString().split("T")[0];

    const roast = await db.prepare(
      `SELECT * FROM roast_submissions WHERE rotd_date = ? AND selected_for_rotd = 1`
    ).bind(today).first();

    if (!roast) {
      return NextResponse.json({ error: "No ROTD selected today" }, { status: 404 });
    }

    if (roast.posted_to_telegram) {
      return NextResponse.json({ message: "Already posted to Telegram" });
    }

    const roastText = roast.roast_text.split(/DEGEN SCORE/i)[0].trim();

    const message = [
      `🔥 <b>Roast of the Day</b>`,
      ``,
      `<code>${roast.wallet_short}</code>`,
      ``,
      roastText,
      ``,
      `<i>— CLAUDIA</i>`,
      ``,
      `<a href="https://roast.claudia.wtf">Get roasted →</a>`,
    ].join("\n");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram post failed:", err);
      return NextResponse.json({ error: "Telegram post failed" }, { status: 502 });
    }

    await db.prepare(
      `UPDATE roast_submissions SET posted_to_telegram = 1 WHERE id = ?`
    ).bind(roast.id).run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram post error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}
