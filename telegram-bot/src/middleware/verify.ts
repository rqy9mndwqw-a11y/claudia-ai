import type { Context } from "grammy";
import { upsertUser } from "../lib/db.js";
import type { Env } from "../types.js";

/**
 * Handle captcha button callback.
 * Callback data: "verify"
 */
export async function handleVerifyCallback(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  try {
    await upsertUser(env.DB, tgId, {
      is_verified: 1,
      username: ctx.from?.username || null,
      display_name: ctx.from?.first_name || null,
    });

    await ctx.answerCallbackQuery({ text: "verified!" });

    // Delete the captcha message
    try { await ctx.deleteMessage(); } catch {}

    await ctx.reply(
      `\u2705 verified. you're in.\n\nCLAUDIA is an AI intelligence platform for speculative assets.\nbuilt on Base. token-gated. deflationary.\n\nhere's what you can do:\n\u2022 /scan \u2014 latest market signals\n\u2022 /analyze [ticker] \u2014 chart analysis\n\u2022 /price \u2014 current $CLAUDIA price\n\u2022 /wallet [0x...] \u2014 link your wallet\n\u2022 /invite \u2014 get your referral link\n\u2022 /credits \u2014 check balance\n\u2022 /help \u2014 full command list\n\nfree tier: 3 queries/day\nhold 1M $CLAUDIA \u2192 10/day\nhold 5M $CLAUDIA \u2192 unlimited\n\napp.claudia.wtf`
    );
  } catch (e) {
    console.error("Verify error:", (e as Error).message);
    await ctx.answerCallbackQuery({ text: "error, try again" });
  }
}
