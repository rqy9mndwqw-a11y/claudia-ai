import { upsertUser, getUser } from "../lib/db.js";
import { tierLabel, resolveTier } from "../lib/tiers.js";
import { getClaudiaBalance } from "../lib/balance.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function walletCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "wallet")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const text = ctx.message?.text || "";
  const parts = text.split(/\s+/);
  const address = parts[1];

  if (!address) {
    const user = await getUser(env.DB, tgId);
    if (user?.wallet_address) {
      const short = `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`;
      const balance = await getClaudiaBalance(user.wallet_address);
      const { tier, dailyLimit } = resolveTier(balance);
      await ctx.reply(
        `linked wallet: ${short}\n\n$CLAUDIA balance: ${balance.toLocaleString()}\ntier: ${tierLabel(tier)}\ndaily queries: ${dailyLimit === Infinity ? "unlimited" : dailyLimit}\n\nto change: /wallet 0xNewAddress`
      );
    } else {
      await ctx.reply("no wallet linked.\n\nusage: /wallet 0xYourAddress\n\nlink your wallet to access agents, earn credits, and track your tier.");
    }
    return;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    await ctx.reply("invalid address format. must be 0x followed by 40 hex characters.\n\nexample: /wallet 0x1234...5678");
    return;
  }

  const normalized = address.toLowerCase();

  const existing = await env.DB.prepare(
    "SELECT tg_id FROM telegram_users WHERE wallet_address = ? AND tg_id != ?"
  ).bind(normalized, tgId).first();

  if (existing) {
    await ctx.reply("this wallet is already linked to another Telegram account.");
    return;
  }

  await upsertUser(env.DB, tgId, {
    wallet_address: normalized,
    username: ctx.from?.username || null,
    display_name: ctx.from?.first_name || null,
  });

  // Check on-chain balance
  const balance = await getClaudiaBalance(normalized);
  const { tier, dailyLimit } = resolveTier(balance);

  const short = `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  await ctx.reply(
    `\u2705 wallet linked: ${short}\n\nyour $CLAUDIA balance: ${balance.toLocaleString()}\ntier: ${tierLabel(tier)}\ndaily queries: ${dailyLimit === Infinity ? "unlimited" : dailyLimit}\n\nhold 1M+ $CLAUDIA for 10 queries/day.\nhold 5M+ for unlimited.\n\nbuy on Aerodrome: app.claudia.wtf/buy`
  );
}
