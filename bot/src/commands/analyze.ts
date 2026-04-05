import type { Context } from "grammy";
import type { Env } from "../types.js";
import { getTelegramUser } from "../lib/db.js";
import { checkBotRateLimit, incrementQueryCount } from "../lib/rate-limit.js";
import { callAgent } from "../lib/claudia-api.js";
import { escapeHtml } from "../lib/format.js";

export function handleAnalyze(env: Env) {
  return async (ctx: Context) => {
    const text = ctx.message?.text || "";
    const ticker = text.split(/\s+/)[1]?.toUpperCase();

    if (!ticker) {
      await ctx.reply("what token?\n\n<code>/analyze BTC</code>", { parse_mode: "HTML" });
      return;
    }

    const telegramId = String(ctx.from?.id);
    const user = await getTelegramUser(env.DB, telegramId);

    if (!user?.wallet_address) {
      await ctx.reply(
        "link your wallet first:\n<code>/wallet 0x...</code>\n\ni need it to check your balance.",
        { parse_mode: "HTML" }
      );
      return;
    }

    const rl = await checkBotRateLimit(env.DB, telegramId);
    if (!rl.allowed) {
      await ctx.reply(
        "you've used your 3 free queries today.\ncome back tomorrow or hold 1M $CLAUDIA for more.\n\napp.claudia.wtf/credits"
      );
      return;
    }

    await ctx.reply(`analyzing ${ticker}... one sec.`);
    await incrementQueryCount(env.DB, telegramId);

    try {
      const reply = await callAgent(
        env.MAIN_APP_URL,
        env.BOT_INTERNAL_SECRET,
        "claudia-chart-reader",
        `Full technical analysis of ${ticker}`,
        user.wallet_address
      );

      // Truncate for Telegram 4096 char limit
      const safe = escapeHtml(reply).slice(0, 3900);
      await ctx.reply(safe + `\n\n<i>${rl.remaining} queries remaining today</i>`, { parse_mode: "HTML" });
    } catch {
      await ctx.reply("something broke. try again in a minute.");
    }
  };
}
