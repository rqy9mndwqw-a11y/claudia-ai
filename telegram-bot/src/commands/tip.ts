import { getUser, logEngagement } from "../lib/db.js";
import { getCreditsBalance, addCredits } from "../lib/api.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function tipCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "tip")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const user = await getUser(env.DB, tgId);
  if (!user?.wallet_address) {
    await ctx.reply("link your wallet first: /wallet 0xYourAddress");
    return;
  }

  const text = ctx.message?.text || "";
  const match = text.match(/^\/tip\s+@?(\S+)\s+(\d+)/i);
  if (!match) {
    await ctx.reply("usage: /tip @username 5\n\nmin: 1 credit, max: 50 per tip.");
    return;
  }

  const targetUsername = match[1].toLowerCase();
  const amount = parseInt(match[2]);

  if (amount < 1 || amount > 50) {
    await ctx.reply("tip must be between 1 and 50 credits.");
    return;
  }

  // Can't tip yourself
  if (targetUsername === (ctx.from?.username || "").toLowerCase()) {
    await ctx.reply("you can't tip yourself.");
    return;
  }

  // Find target user
  const target = await env.DB.prepare(
    "SELECT * FROM telegram_users WHERE LOWER(username) = ?"
  ).bind(targetUsername).first<any>();

  if (!target?.wallet_address) {
    await ctx.reply(`@${targetUsername} hasn't linked a wallet yet. they need to use /wallet first.`);
    return;
  }

  // Check tipper balance
  const balance = await getCreditsBalance(env, user.wallet_address);
  if (balance < amount) {
    await ctx.reply(`not enough credits. you have ${balance}.\n\nbuy more: app.claudia.wtf/credits`);
    return;
  }

  // Deduct from tipper, add to recipient
  try {
    const deductOk = await addCredits(env, user.wallet_address, -amount, `tip_to_${target.tg_id}`);
    if (!deductOk) {
      await ctx.reply("tip failed. try again.");
      return;
    }
    await addCredits(env, target.wallet_address, amount, `tip_from_${tgId}`);

    // Log engagement for both
    await logEngagement(env.DB, tgId, user.wallet_address, "tip", 3).catch(() => {});
    await logEngagement(env.DB, target.tg_id, target.wallet_address, "tip", 1).catch(() => {});

    await ctx.reply(`\u2705 tipped @${targetUsername} ${amount} credit${amount > 1 ? "s" : ""}.\nyour balance: ${balance - amount} credits remaining.`);
  } catch {
    await ctx.reply("tip failed. try again.");
  }
}
