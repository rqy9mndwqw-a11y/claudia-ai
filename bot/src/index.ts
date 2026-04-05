import { Bot, webhookCallback } from "grammy";
import type { Env } from "./types.js";
import { handleStart } from "./commands/start.js";
import { handleHelp } from "./commands/help.js";
import { handleWallet } from "./commands/wallet.js";
import { handleScan } from "./commands/scan.js";
import { handleAnalyze } from "./commands/analyze.js";
import { handleAsk } from "./commands/ask.js";
import { handleCredits } from "./commands/credits.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Webhook setup helper
    if (new URL(request.url).pathname === "/setup-webhook") {
      const webhookUrl = `${new URL(request.url).origin}/`;
      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const data = await res.json() as any;
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    bot.command("start", handleStart());
    bot.command("help", handleHelp());
    bot.command("wallet", handleWallet(env));
    bot.command("scan", handleScan(env));
    bot.command("analyze", handleAnalyze(env));
    bot.command("ask", handleAsk(env));
    bot.command("credits", handleCredits(env));

    // Catch-all for unknown commands
    bot.on("message:text", async (ctx) => {
      await ctx.reply(
        "didn't catch that. try /help for commands."
      );
    });

    try {
      const handleUpdate = webhookCallback(bot, "cloudflare-mod");
      return handleUpdate(request);
    } catch (err) {
      console.error("Bot error:", (err as Error).message);
      return new Response("OK");
    }
  },
};
