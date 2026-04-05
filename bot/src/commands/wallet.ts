import type { Context } from "grammy";
import type { Env } from "../types.js";
import { linkWallet, getTelegramUser } from "../lib/db.js";

export function handleWallet(env: Env) {
  return async (ctx: Context) => {
    const text = ctx.message?.text || "";
    const parts = text.split(/\s+/);
    const address = parts[1];

    if (!address) {
      // Show current wallet
      const user = await getTelegramUser(env.DB, String(ctx.from?.id));
      if (user?.wallet_address) {
        await ctx.reply(
          `your wallet: <code>${user.wallet_address}</code>\n\nto change it: <code>/wallet 0xNEW...</code>`,
          { parse_mode: "HTML" }
        );
      } else {
        await ctx.reply(
          "no wallet linked yet.\n\n<code>/wallet 0x...</code>",
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      await ctx.reply("that doesn't look like a valid wallet address. try again.");
      return;
    }

    await linkWallet(env.DB, String(ctx.from?.id), ctx.from?.username || null, address);
    await ctx.reply(
      `wallet linked: <code>${address.slice(0, 6)}...${address.slice(-4)}</code>\n\nnow try: <code>/analyze BTC</code>`,
      { parse_mode: "HTML" }
    );
  };
}
