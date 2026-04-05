import type { Context } from "grammy";

export function handleHelp() {
  return async (ctx: Context) => {
    await ctx.reply(
      [
        "<b>commands:</b>",
        "",
        "/scan \u2014 latest market scanner results",
        "/analyze [ticker] \u2014 technical analysis (2 credits)",
        "/ask [question] \u2014 DeFi questions (1 credit)",
        "/wallet [0x...] \u2014 link your wallet",
        "/credits \u2014 check your balance",
        "",
        "3 free queries/day. link wallet for credit-based access.",
        "",
        "app.claudia.wtf",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  };
}
