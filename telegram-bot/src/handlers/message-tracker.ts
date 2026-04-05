import { getDailyEngagementCount, logEngagement, upsertUser } from "../lib/db.js";
import type { Env } from "../types.js";

/**
 * Passive message tracking — logs 1 engagement point per day per user.
 * Max 1 "message" point per day (not per message).
 * Skips bots and commands.
 */
export async function trackMessage(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const from = ctx.from;
  if (!from || from.is_bot) return;

  // Skip commands
  const text = ctx.message?.text || "";
  if (text.startsWith("/")) return;

  const tgId = from.id.toString();

  try {
    // Check if already logged today
    const count = await getDailyEngagementCount(env.DB, tgId);
    if (count >= 1) return; // Already got daily point

    await logEngagement(env.DB, tgId, null, "message", 1);
    await upsertUser(env.DB, tgId, {
      username: from.username || null,
      display_name: from.first_name || null,
    });
  } catch {
    // Never crash the bot on tracking errors
  }
}
