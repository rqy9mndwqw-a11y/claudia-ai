import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Farcaster Mini App webhook — receives events when users
 * add/remove the app or enable/disable notifications.
 */
export async function POST(req: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;
    const body = (await req.json()) as { payload?: string };
    const { payload } = body;

    if (!payload) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    const { event, fid, notificationDetails } = decoded;

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
