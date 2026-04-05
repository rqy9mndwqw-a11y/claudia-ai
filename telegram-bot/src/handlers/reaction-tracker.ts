import { Context } from "grammy";

/**
 * Track 🔥 reactions on ROTD candidate messages.
 * Updates reaction_count in roast_submissions table.
 *
 * Telegram sends `message_reaction_count` updates for group messages.
 * Each update contains the full current reaction counts for a message.
 */
export async function handleReactionCount(ctx: Context): Promise<void> {
  const env = (ctx as any).env;
  if (!env?.DB) return;

  const update = ctx.update as any;
  const reactionCount = update.message_reaction_count;
  if (!reactionCount) return;

  const messageId = reactionCount.message_id;
  const chatId = reactionCount.chat?.id;

  // Only track reactions in our group
  const groupId = env.CLAUDIA_GROUP_CHAT_ID;
  if (groupId && String(chatId) !== String(groupId)) return;

  // Count 🔥 reactions
  const reactions = reactionCount.reactions || [];
  let fireCount = 0;
  for (const r of reactions) {
    if (r.type?.emoji === "🔥" || r.type === "🔥") {
      fireCount = r.total_count || r.count || 0;
    }
  }

  // Update D1 if this message_id matches a roast submission
  try {
    await env.DB.prepare(
      `UPDATE roast_submissions SET reaction_count = ? WHERE telegram_message_id = ?`
    ).bind(fireCount, messageId).run();
  } catch (err) {
    console.error("Reaction track error:", (err as Error).message);
  }
}
