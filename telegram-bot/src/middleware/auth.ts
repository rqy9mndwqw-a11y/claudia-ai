import type { NextFunction } from "grammy";
import { getUser, getQueriesToday } from "../lib/db.js";
import { resolveTier } from "../lib/tiers.js";
import { getClaudiaBalance } from "../lib/balance.js";
import type { Env, TelegramUser } from "../types.js";

/**
 * Load TG user from D1 and attach to context.
 */
export async function loadUser(ctx: any, next: NextFunction): Promise<void> {
  const tgId = ctx.from?.id?.toString();
  if (tgId) {
    const env = ctx.env as Env;
    ctx.tgUser = await getUser(env.DB, tgId);
  }
  await next();
}

/**
 * Check if user can run a query (has remaining daily limit).
 * Returns null if OK, or an error message string if blocked.
 */
export async function checkQueryLimit(db: D1Database, user: TelegramUser | undefined): Promise<string | null> {
  if (!user) {
    return "use /start first, then /wallet to link your address.";
  }

  const queriesUsed = await getQueriesToday(db, user.tg_id);

  if (user.wallet_address) {
    // Check on-chain balance for tier
    const balance = await getClaudiaBalance(user.wallet_address);
    const { dailyLimit } = resolveTier(balance);

    console.log(JSON.stringify({ event: "query_limit_check", tgId: user.tg_id, balance, dailyLimit, queriesUsed }));

    if (dailyLimit === Infinity) return null; // Unlimited
    if (queriesUsed >= dailyLimit) {
      return `daily limit reached (${dailyLimit}/day). hold more $CLAUDIA for higher limits.\n\n1M+ = 10/day\n5M+ = unlimited\n\nbuy: app.claudia.wtf/buy`;
    }
  } else {
    if (queriesUsed >= 3) {
      return "free tier limit reached (3/day).\n\nlink your wallet with /wallet 0x... for more access.\nhold 1M+ $CLAUDIA for 10/day.";
    }
  }

  return null;
}
