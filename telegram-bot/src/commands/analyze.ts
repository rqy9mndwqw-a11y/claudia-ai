import { chatWithAgent } from "../lib/api.js";
import { incrementQueries, logEngagement } from "../lib/db.js";
import { checkQueryLimit } from "../middleware/auth.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function analyzeCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "analyze")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const text = ctx.message?.text || "";
  const parts = text.split(/\s+/);
  const ticker = parts[1]?.toUpperCase();
  const interval = parts[2] || "1h";

  if (!ticker) {
    await ctx.reply("usage: /analyze ETH\nor: /analyze SOL 4h\n\nruns full technical analysis on any token.");
    return;
  }

  const limitMsg = await checkQueryLimit(env.DB, ctx.tgUser);
  if (limitMsg) {
    await ctx.reply(limitMsg);
    return;
  }

  const walletAddress = ctx.tgUser?.wallet_address || "0x0000000000000000000000000000000000000000";

  await ctx.reply(`analyzing ${ticker}...`);

  try {
    const result = await chatWithAgent(
      env,
      "claudia-chart-reader",
      `Full technical analysis of ${ticker} on the ${interval} timeframe`,
      walletAddress
    );

    if (!result?.reply) {
      await ctx.reply("analysis failed. try again shortly.", { link_preview_options: { is_disabled: true } });
      return;
    }

    const reply = result.reply.length > 3900
      ? result.reply.slice(0, 3900) + "\n\n... full analysis at app.claudia.wtf"
      : result.reply + "\n\nDYOR.";

    await ctx.reply(reply, { link_preview_options: { is_disabled: true } });

    await incrementQueries(env.DB, tgId).catch(() => {});
    await logEngagement(env.DB, tgId, ctx.tgUser?.wallet_address || null, "agent_run", 2).catch(() => {});
  } catch (err) {
    console.error("Analyze error:", (err as Error).message);
    await ctx.reply("analysis failed. try again in a minute.");
  }
}
