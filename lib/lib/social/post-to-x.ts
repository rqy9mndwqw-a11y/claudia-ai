/**
 * X (Twitter) API v2 posting via OAuth 1.0a.
 * No npm packages — pure crypto + fetch.
 * Fire-and-forget — never blocks scanner.
 */

import crypto from "crypto";

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface ScanResultForPost {
  symbol: string;
  score: number;
  rating: string;
  reasoning: string;
  price?: number;
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: XCredentials
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(credentials.apiSecret)}&${encodeURIComponent(credentials.accessTokenSecret)}`;

  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildOAuthHeader(
  method: string,
  url: string,
  credentials: XCredentials
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, credentials);
  oauthParams.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(oauthParams)
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(", ")
  );
}

function buildScanTweet(
  summary: string,
  topPicks: ScanResultForPost[],
  marketMood: string,
  pairCount: number
): string {
  const scoreEmoji = (score: number) =>
    score >= 7 ? "\u{1F7E2}" : score >= 4 ? "\u{1F7E1}" : "\u{1F534}";

  const formatPrice = (price?: number) => {
    if (!price) return "";
    if (price >= 1000) return ` $${Math.round(price).toLocaleString()}`;
    if (price >= 1) return ` $${price.toFixed(2)}`;
    if (price >= 0.01) return ` $${price.toFixed(4)}`;
    return ` $${price.toFixed(6)}`;
  };

  const picks = topPicks
    .slice(0, 3)
    .map((p) => `${scoreEmoji(p.score)} ${p.symbol}${formatPrice(p.price)} \u2014 ${p.score}/10`)
    .join("\n");

  const tweet = [
    `\u26A1 CLAUDIA scanned ${pairCount} pairs. here's what the data says.`,
    "",
    picks,
    "",
    "scores based on RSI, MACD, BB + more.",
    "DYOR.",
    "",
    "app.claudia.wtf/scanner",
    "$CLAUDIA #Base #DeFi",
  ].join("\n");

  if (tweet.length > 280) {
    return buildScanTweet(summary.slice(0, 60) + "...", topPicks.slice(0, 2), marketMood, pairCount);
  }

  return tweet;
}

/**
 * Post a reply to an existing tweet (for performance follow-ups).
 */
export async function postReplyToX(
  text: string,
  replyToTweetId: string,
  credentials: XCredentials
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  if (!credentials.apiKey || !credentials.accessToken) {
    return { success: false, error: "X credentials not configured" };
  }

  const url = "https://api.twitter.com/2/tweets";
  const oauthHeader = buildOAuthHeader("POST", url, credentials);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: replyToTweetId },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(JSON.stringify({ event: "x_reply_failed", status: response.status, error: errorBody }));
      return { success: false, error: `X API ${response.status}` };
    }

    const data = (await response.json()) as any;
    console.log(JSON.stringify({ event: "x_reply_success", tweetId: data?.data?.id, replyTo: replyToTweetId }));
    return { success: true, tweetId: data?.data?.id };
  } catch (error) {
    console.error(JSON.stringify({ event: "x_reply_error", error: (error as Error).message }));
    return { success: false, error: (error as Error).message };
  }
}

export async function postScanToX(
  summary: string,
  topPicks: ScanResultForPost[],
  marketMood: string,
  pairCount: number,
  credentials: XCredentials
): Promise<{ success: boolean; tweetId?: string; error?: string; details?: string }> {
  if (!credentials.apiKey || !credentials.accessToken) {
    return { success: false, error: "X credentials not configured" };
  }

  const tweetText = buildScanTweet(summary, topPicks, marketMood, pairCount);
  const url = "https://api.twitter.com/2/tweets";
  const oauthHeader = buildOAuthHeader("POST", url, credentials);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(JSON.stringify({ event: "x_post_failed", status: response.status, error: errorBody }));
      return { success: false, error: `X API ${response.status}`, details: errorBody };
    }

    const data = (await response.json()) as any;
    console.log(
      JSON.stringify({ event: "x_post_success", tweetId: data?.data?.id, mood: marketMood, pairs: pairCount })
    );
    return { success: true, tweetId: data?.data?.id };
  } catch (error) {
    console.error(JSON.stringify({ event: "x_post_error", error: (error as Error).message }));
    return { success: false, error: (error as Error).message };
  }
}
