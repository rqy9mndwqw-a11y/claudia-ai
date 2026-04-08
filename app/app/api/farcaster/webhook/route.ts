import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Farcaster Mini App webhook — receives events when users
 * add/remove the app or enable/disable notifications.
 *
 * Protected by a shared secret (FARCASTER_WEBHOOK_SECRET).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret to prevent unauthorized writes to D1
    // Fail closed: reject if secret is not configured or doesn't match
    const secret = process.env.FARCASTER_WEBHOOK_SECRET;
    if (!secret) {
      console.error("FARCASTER_WEBHOOK_SECRET not configured — rejecting webhook");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { env } = await getCloudflareContext();
    const db = (env as any).DB;
    const body = (await req.json().catch(() => null)) as { payload?: string } | null;

    if (!body?.payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const { payload } = body;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    const { event, fid, notificationDetails } = decoded;

    // Validate fid is a number
    if (typeof fid !== "number" || !Number.isInteger(fid) || fid <= 0) {
      return NextResponse.json({ error: "Invalid fid" }, { status: 400 });
    }

    console.log(
      JSON.stringify({ event: "farcaster_webhook", type: event, fid })
    );

    switch (event) {
      case "frame_added":
      case "notifications_enabled":
        if (notificationDetails) {
          await db
            .prepare(
              `INSERT INTO farcaster_notifications (fid, token, url, created_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (fid) DO UPDATE SET
                 token = excluded.token,
                 url = excluded.url,
                 updated_at = ?`
            )
            .bind(
              fid,
              notificationDetails.token,
              notificationDetails.url,
              Date.now(),
              Date.now()
            )
            .run();
        }
        break;

      case "frame_removed":
      case "notifications_disabled":
        await db
          .prepare("DELETE FROM farcaster_notifications WHERE fid = ?")
          .bind(fid)
          .run();
        break;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Farcaster webhook error:", String(err));
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
