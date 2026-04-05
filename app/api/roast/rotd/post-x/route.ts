import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Posts Roast of the Day to X/Twitter via API v2
// Called after ROTD selection

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf(". ");
  const lastBang = cut.lastIndexOf("! ");
  const boundary = Math.max(lastPeriod, lastBang);
  return boundary > maxLen * 0.5 ? cut.slice(0, boundary + 1) : cut.replace(/\s+\S*$/, "") + "...";
}

async function getOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): Promise<string> {
  // Twitter OAuth 1.0a signing
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const params: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const sortedParams = Object.keys(params).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join("&");

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  params.oauth_signature = signature;

  return "OAuth " + Object.keys(params).sort().map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`
  ).join(", ");
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.BOT_INTERNAL_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.X_API_KEY || "";
  const apiSecret = process.env.X_API_SECRET || "";
  const accessToken = process.env.X_ACCESS_TOKEN || "";
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET || "";

  if (!apiKey || !accessToken) {
    return NextResponse.json({ error: "Twitter credentials not configured" }, { status: 503 });
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

    if (roast.posted_to_x) {
      return NextResponse.json({ message: "Already posted to X" });
    }

    const roastText = truncateAtSentence(roast.roast_text.split(/DEGEN SCORE/i)[0].trim(), 220);
    const tweet = `🔥 Roast of the Day\n\n${roast.wallet_short}\n\n${roastText}\n\n— @0xCLAUDIA_wtf\n\nroast.claudia.wtf`;

    const tweetUrl = "https://api.twitter.com/2/tweets";
    const oauthHeader = await getOAuthHeader("POST", tweetUrl, apiKey, apiSecret, accessToken, accessSecret);

    const res = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweet }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Twitter post failed:", err);
      return NextResponse.json({ error: "Twitter post failed", detail: err }, { status: 502 });
    }

    await db.prepare(
      `UPDATE roast_submissions SET posted_to_x = 1 WHERE id = ?`
    ).bind(roast.id).run();

    const data = await res.json();
    return NextResponse.json({ ok: true, tweetId: (data as any).data?.id });
  } catch (err) {
    console.error("X post error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}
