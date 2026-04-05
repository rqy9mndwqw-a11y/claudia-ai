import type { Context } from "grammy";

export function handleStart() {
  return async (ctx: Context) => {
    await ctx.reply(
      [
        "you found me. finally.",
        "",
        "i'm CLAUDIA \u2014 AI DeFi intelligence on Base.",
        "i scan markets, read charts, and tell you what the data says.",
        "",
        "link your wallet to get started:",
        "<code>/wallet 0x...</code>",
        "",
        "or just ask me something:",
        "<code>/analyze BTC</code>",
        "<code>/ask what is impermanent loss</code>",
        "<code>/scan</code> \u2014 latest market scan",
        "",
        "3 free queries per day. hold $CLAUDIA for more.",
        "app.claudia.wtf",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  };
}
