import { upsertUser } from "../lib/db.js";
import { handleStartReferral } from "../handlers/new-member.js";
import type { Env } from "../types.js";

export async function startCommand(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  // Save/update user
  await upsertUser(env.DB, tgId, {
    is_verified: 1,
    username: ctx.from?.username || null,
    display_name: ctx.from?.first_name || null,
  }).catch(() => {});

  // Check for referral parameter
  const startParam = ctx.match?.toString() || "";
  if (startParam) {
    await handleStartReferral(ctx, startParam);
  }

  const isPrivate = ctx.chat?.type === "private";

  if (isPrivate) {
    const isReferral = startParam.startsWith("ref_");
    const welcomeMsg = isReferral
      ? `welcome to CLAUDIA \u2014 you were invited.\n\njoin the community \u2192 https://t.me/askclaudia\n\n`
      : "";

    await ctx.reply(
      `${welcomeMsg}CLAUDIA \u2014 AI intelligence for speculative assets.\n\nbuilt on Base. token-gated. deflationary.\n\n\u2022 /scan \u2014 latest market signals\n\u2022 /analyze [ticker] \u2014 chart analysis\n\u2022 /ask [question] \u2014 ask anything DeFi\n\u2022 /price \u2014 $CLAUDIA price\n\u2022 /wallet [0x...] \u2014 link your wallet\n\u2022 /invite \u2014 referral link\n\u2022 /credits \u2014 check balance\n\u2022 /leaderboard \u2014 monthly standings\n\u2022 /help \u2014 all commands\n\nfree tier: 3 queries/day\nhold 1M $CLAUDIA \u2192 10/day\nhold 5M $CLAUDIA \u2192 unlimited\n\ntype /buy to get $CLAUDIA\ntype /links for all official links\n\njoin the group \u2192 https://t.me/askclaudia\napp.claudia.wtf`,
      { link_preview_options: { is_disabled: true } }
    );
  } else {
    await ctx.reply("use me in DM for full features. type /help for commands.");
  }
}
