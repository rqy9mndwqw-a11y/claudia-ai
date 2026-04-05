import { getLatestScan } from "../lib/api.js";
import { incrementQueries, logEngagement } from "../lib/db.js";
import { checkQueryLimit } from "../middleware/auth.js";
import { scoreEmoji, formatPrice } from "../lib/format.js";
import type { Env } from "../types.js";

export async function scanCommand(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  // Check rate limit
  const limitMsg = await checkQueryLimit(env.DB, ctx.tgUser);
  if (limitMsg) {
    await ctx.reply(limitMsg);
    return;
  }

  await ctx.reply("scanning...");

  try {
    const data = await getLatestScan(env);
    if (!data || !data.topPicks?.length) {
      await ctx.reply("no scan data available right now. check back after the next scan.\n\napp.claudia.wtf/scanner");
      return;
    }

    const picks = data.topPicks.slice(0, 5).map((p: any) =>
      `${scoreEmoji(p.score)} ${p.symbol} \u2014 ${p.score}/10 (${p.rating || ""})`
    );

    const reply = [
      `\u{1F4CA} CLAUDIA scanned ${data.pairCount || "40+"} pairs.`,
      "",
      ...picks,
      "",
      `market mood: ${(data.marketMood || "neutral").toLowerCase()}`,
      "",
      "full analysis \u2192 app.claudia.wtf/scanner",
      "DYOR.",
    ].join("\n");

    await ctx.reply(reply);

    // Track usage
    await incrementQueries(env.DB, tgId).catch(() => {});
    await logEngagement(env.DB, tgId, ctx.tgUser?.wallet_address || null, "agent_run", 2).catch(() => {});
  } catch {
    await ctx.reply("scan failed. try again in a minute.\n\napp.claudia.wtf/scanner");
  }
}
