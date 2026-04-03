/**
 * Feed post writer — auto-posts to the CLAUDIA feed from agent routes.
 * All calls are fire-and-forget: never throws, never blocks the main response.
 */

export interface FeedPostInput {
  post_type: "agent_post" | "alpha_alert" | "market_scan";
  agent_job?: string;
  title: string;
  content: string;
  full_content?: string;
  verdict?: "Buy" | "Hold" | "Avoid";
  score?: number;
  risk?: string;
  token_symbol?: string;
  author_address?: string;
}

export async function writeFeedPost(
  db: D1Database,
  post: FeedPostInput,
): Promise<void> {
  try {
    const content = post.content.length > 280
      ? post.content.slice(0, 277) + "..."
      : post.content;

    await db.prepare(
      `INSERT INTO feed_posts
       (id, post_type, agent_job, title, content, full_content, verdict, score, risk, token_symbol, author_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      post.post_type,
      post.agent_job || null,
      post.title,
      content,
      post.full_content || null,
      post.verdict || null,
      post.score ?? null,
      post.risk || null,
      post.token_symbol || null,
      post.author_address || null,
      Date.now(),
    ).run();
  } catch (err) {
    console.error(JSON.stringify({
      event: "feed_post_write_error",
      post_type: post.post_type,
      error: (err as Error).message,
    }));
  }
}
