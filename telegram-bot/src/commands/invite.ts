import { getReferralCount } from "../lib/db.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function inviteCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "invite")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const { total, active } = await getReferralCount(env.DB, tgId);

  const rewardTiers = [
    { count: 1, reward: 10 },
    { count: 5, reward: 50 },
    { count: 10, reward: 150 },
    { count: 25, reward: 500 },
  ];

  const earned = rewardTiers
    .filter(t => active >= t.count)
    .reduce((sum, t) => sum + t.reward, 0);

  await ctx.reply(
    `your invite link:\nt.me/CLAUDIA_wtf_bot?start=ref_${tgId}\n\nshare this link. earn rewards when people join and stay active.\n\nyour referrals: ${total} total (${active} active)\nearned so far: ${earned} credits\n\nreferral rewards:\n1 active referral \u2192 10 credits\n5 referrals \u2192 50 credits\n10 referrals \u2192 150 credits\n25 referrals \u2192 500 credits\n\na referral is "active" after 7 days in the group with 3+ messages.`
  );
}
