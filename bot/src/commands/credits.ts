import type { Context } from "grammy";
import type { Env } from "../types.js";
import { getTelegramUser, getUserCredits } from "../lib/db.js";

export function handleCredits(env: Env) {
  return async (ctx: Context) => {
    const telegramId = String(ctx.from?.id);
    const user = await getTelegramUser(env.DB, telegramId);

    if (!user?.wallet_address) {
      await ctx.reply(
        "no wallet linked.\n<code>/wallet 0x...</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    const credits = await getUserCredits(env.DB, user.wallet_address);
    const addr = user.wallet_address;

    await ctx.reply(
      [
        `wallet: <code>${addr.slice(0, 6)}...${addr.slice(-4)}</code>`,
        `credits: <b>${credits}</b>`,
        "",
        credits === 0
          ? "no credits. buy some at app.claudia.wtf/credits"
          : `use /analyze or /ask to spend them.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  };
}
