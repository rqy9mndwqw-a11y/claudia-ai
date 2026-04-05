export async function helpCommand(ctx: any): Promise<void> {
  const isPrivate = ctx.chat?.type === "private";

  const commands = [
    "\u{1F4CA} Market",
    "/scan \u2014 latest market signals",
    "/analyze [ticker] \u2014 chart analysis",
    "/ask [question] \u2014 ask anything DeFi",
    "/price \u2014 $CLAUDIA price",
    "",
    "\u{1F4B0} Account",
    "/wallet [0x...] \u2014 link your wallet",
    "/credits \u2014 check balance",
    "/tip @user [amount] \u2014 tip credits",
    "",
    "\u{1F3C6} Community",
    "/invite \u2014 get referral link",
    "/leaderboard \u2014 monthly standings",
    "",
    "\u{1F527} Info",
    "/help \u2014 this message",
    "/start \u2014 restart the bot",
  ];

  if (!isPrivate) {
    commands.push("", "DM me for full features \u2192 @CLAUDIA_wtf_bot");
  }

  commands.push(
    "",
    "free: 3 queries/day",
    "1M $CLAUDIA: 10/day",
    "5M $CLAUDIA: unlimited",
    "",
    "app.claudia.wtf"
  );

  await ctx.reply(commands.join("\n"));
}
