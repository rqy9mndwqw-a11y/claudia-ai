import { getLeaderboard, getMonthlyPoints } from "../lib/db.js";
import { rankEmoji } from "../lib/format.js";
import type { Env } from "../types.js";

export async function leaderboardCommand(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();

  try {
    const leaders = await getLeaderboard(env.DB, 10);
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const weekNum = Math.ceil(new Date().getDate() / 7);

    if (leaders.length === 0) {
      await ctx.reply(`\u{1F4CA} ${month} \u2014 no activity yet this month.\n\nstart earning points:\n\u2022 be active in the group (1 pt/day)\n\u2022 run /scan or /analyze (2 pts)\n\u2022 refer friends with /invite (15 pts)`);
      return;
    }

    const lines = leaders.map((l, i) => {
      const name = l.display_name.startsWith("@") ? l.display_name : `@${l.display_name}`;
      return `${rankEmoji(i + 1)} ${name} \u2014 ${l.total} ${l.total === 1 ? "pt" : "pts"}`;
    });

    let userRank = "";
    if (tgId) {
      const userPts = await getMonthlyPoints(env.DB, tgId);
      if (userPts > 0) {
        const rank = leaders.findIndex(l => l.tg_id === tgId);
        if (rank >= 0) {
          userRank = `\nyour rank: #${rank + 1} (${userPts} pts)`;
        } else {
          userRank = `\nyour points: ${userPts} pts`;
        }
      }
    }

    await ctx.reply(
      `\u{1F4CA} ${month} \u2014 week ${weekNum} standings\n\n${lines.join("\n")}\n\nrewards drop 1st of next month.\nkeep grinding \u{1F440}${userRank}\n\napp.claudia.wtf/leaderboard`,
      { link_preview_options: { is_disabled: true } }
    );
  } catch {
    await ctx.reply("leaderboard unavailable. try again.");
  }
}
