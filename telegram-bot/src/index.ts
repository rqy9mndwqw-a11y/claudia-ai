import { Bot, webhookCallback } from "grammy";
import type { Env } from "./types.js";

// Commands
import { startCommand } from "./commands/start.js";
import { walletCommand } from "./commands/wallet.js";
import { scanCommand } from "./commands/scan.js";
import { analyzeCommand } from "./commands/analyze.js";
import { askCommand } from "./commands/ask.js";
import { priceCommand } from "./commands/price.js";
import { creditsCommand } from "./commands/credits.js";
import { inviteCommand } from "./commands/invite.js";
import { leaderboardCommand } from "./commands/leaderboard.js";
import { tipCommand } from "./commands/tip.js";
import { pollCommand } from "./commands/poll.js";
import { giveawayCommand, handleGiveawayEntry } from "./commands/giveaway.js";
import { helpCommand } from "./commands/help.js";
import { buyCommand } from "./commands/buy.js";
import { linksCommand } from "./commands/links.js";
import { airdropLinkCommand } from "./commands/airdroplink.js";

// Handlers
import { handleNewMember } from "./handlers/new-member.js";
import { trackMessage } from "./handlers/message-tracker.js";
import { handleReactionCount } from "./handlers/reaction-tracker.js";
import { handleInviteAttribution } from "./handlers/invite-attribution.js";

// Middleware
import { loadUser } from "./middleware/auth.js";
import { handleVerifyCallback } from "./middleware/verify.js";

// Crons
import { runDailyReferralCheck, runWeeklyLeaderboard, runMonthlyRewards, runROTDShortlist, runROTDVoteTally, runROTDPost } from "./lib/crons.js";

// Webhooks
import { handleBuyWebhook } from "./webhooks/buys.js";

function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);

  // Inject env into context
  bot.use((ctx, next) => {
    (ctx as any).env = env;
    return next();
  });

  // Load user from D1
  bot.use(loadUser);

  // Commands
  bot.command("start", startCommand);
  bot.command("wallet", walletCommand);
  bot.command("scan", scanCommand);
  bot.command("analyze", analyzeCommand);
  bot.command("ask", askCommand);
  bot.command("price", priceCommand);
  bot.command("credits", creditsCommand);
  bot.command("invite", inviteCommand);
  bot.command("leaderboard", leaderboardCommand);
  bot.command("tip", tipCommand);
  bot.command("poll", pollCommand);
  bot.command("giveaway", giveawayCommand);
  bot.command("help", helpCommand);
  bot.command("buy", buyCommand);
  bot.command("links", linksCommand);
  bot.command("airdroplink", airdropLinkCommand);

  // Admin debug — get chat ID for env config
  bot.command("chatid", async (ctx) => {
    await ctx.reply(`chat ID: ${ctx.chat.id}\n\nset this as CLAUDIA_GROUP_CHAT_ID`);
  });

  // Callback queries
  bot.callbackQuery("verify", handleVerifyCallback);
  bot.callbackQuery(/^giveaway_/, handleGiveawayEntry);

  // New member handler (restricts + captcha)
  bot.on("message:new_chat_members", handleNewMember);

  // Invite link attribution — logs wallet referral ONLY, no permissions
  bot.on("chat_member", handleInviteAttribution);

  // Track 🔥 reactions on ROTD candidate messages
  bot.on("message_reaction_count", handleReactionCount);

  // Passive message tracking (must be last)
  bot.on("message:text", trackMessage);

  // Error handler
  bot.catch((err) => {
    console.error("Bot error:", err.message);
  });

  return bot;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    // Health check
    if (pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", bot: "claudia-telegram" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Buy alert webhook from Alchemy
    if (pathname === "/api/webhooks/buys") {
      return handleBuyWebhook(request, env);
    }

    const bot = createBot(env.TELEGRAM_BOT_TOKEN, env);

    // Inject ExecutionContext so commands can use waitUntil
    bot.use((c, next) => {
      (c as any).executionCtx = ctx;
      return next();
    });

    const handler = webhookCallback(bot, "cloudflare-mod", {
      timeoutMilliseconds: 90_000,
    });
    return handler(request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;

    // ROTD shortlist — 8pm UTC: CLAUDIA picks top 3 and posts for voting
    if (cron === "0 20 * * *") {
      ctx.waitUntil(runROTDShortlist(env));
    }

    // ROTD vote tally — 8:45am UTC (before winner announcement)
    if (cron === "45 8 * * *") {
      ctx.waitUntil(runROTDVoteTally(env));
    }

    // Daily referral activation check + ROTD winner post — 9am UTC
    if (cron === "0 9 * * *") {
      ctx.waitUntil(runDailyReferralCheck(env));
      ctx.waitUntil(runROTDPost(env));
    }

    // Weekly leaderboard — Monday 2pm UTC (9am EST)
    if (cron === "0 14 * * 1") {
      ctx.waitUntil(runWeeklyLeaderboard(env));
    }

    // Monthly rewards — 1st of month 2pm UTC (9am EST)
    if (cron === "0 14 1 * *") {
      ctx.waitUntil(runMonthlyRewards(env));
    }
  },
};
