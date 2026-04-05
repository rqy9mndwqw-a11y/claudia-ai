import { chatWithAgent } from "../lib/api.js";
import { incrementQueries, logEngagement } from "../lib/db.js";
import { checkQueryLimit } from "../middleware/auth.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function askCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "ask")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const text = ctx.message?.text || "";
  const question = text.replace(/^\/ask\s*/i, "").trim();

  if (!question) {
    await ctx.reply("usage: /ask what is impermanent loss?\nor: /ask is ETH bullish right now?");
    return;
  }

  const limitMsg = await checkQueryLimit(env.DB, ctx.tgUser);
  if (limitMsg) {
    await ctx.reply(limitMsg);
    return;
  }

  const walletAddress = ctx.tgUser?.wallet_address || "0x0000000000000000000000000000000000000000";

  await ctx.reply("thinking...");

  try {
    const result = await chatWithAgent(env, "claudia-defi-101", question, walletAddress);

    if (!result?.reply) {
      await ctx.reply("couldn't generate an answer. try rephrasing.");
      return;
    }

    const reply = result.reply.length > 3900
      ? result.reply.slice(0, 3900) + "\n\n..."
      : result.reply + "\n\nDYOR.";

    await ctx.reply(reply, { link_preview_options: { is_disabled: true } });

    await incrementQueries(env.DB, tgId).catch(() => {});
    await logEngagement(env.DB, tgId, ctx.tgUser?.wallet_address || null, "agent_run", 2).catch(() => {});
  } catch (err) {
    console.error("Ask error:", (err as Error).message);
    await ctx.reply("failed to answer. try again shortly.");
  }
}
