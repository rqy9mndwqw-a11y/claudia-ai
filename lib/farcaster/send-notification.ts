import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Send a push notification to a Farcaster user who has saved the Mini App.
 * Silently returns if user hasn't saved the app (no token stored).
 */
export async function sendFarcasterNotification(
  fid: number,
  title: string, // max 32 chars
  body: string, // max 128 chars
  targetUrl: string
): Promise<void> {
  try {
    const { env } = await getCloudflareContext();
    const db = (env as any).DB;

    const record = (await db
      .prepare("SELECT token, url FROM farcaster_notifications WHERE fid = ?")
      .bind(fid)
      .first()) as { token: string; url: string } | null;

    if (!record) return; // User hasn't saved the app — silent return

    const res = await fetch(record.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationId: crypto.randomUUID(),
        title: title.slice(0, 32),
        body: body.slice(0, 128),
        targetUrl,
        tokens: [record.token],
      }),
    });

    if (!res.ok) {
      console.error(
        JSON.stringify({
          event: "farcaster_notification_failed",
          fid,
          status: res.status,
        })
      );
    } else {
      console.log(
        JSON.stringify({ event: "farcaster_notification_sent", fid, title })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "farcaster_notification_error",
        fid,
        error: String(err),
      })
    );
  }
}
