import { InlineKeyboard } from "grammy";
import type { Env } from "../types.js";

async function isAdmin(ctx: any): Promise<boolean> {
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ["creator", "administrator"].includes(member.status);
  } catch {
    return false;
  }
}

export async function giveawayCommand(ctx: any): Promise<void> {
  const env = ctx.env as Env;

  if (ctx.chat?.type === "private") {
    await ctx.reply("giveaways can only be created in the group.");
    return;
  }

  if (!(await isAdmin(ctx))) {
    await ctx.reply("admin only.");
    return;
  }

  const text = ctx.message?.text || "";
  const match = text.match(/^\/giveaway\s+(\d+)\s+(\d+)/i);
  if (!match) {
    await ctx.reply("usage: /giveaway [credits] [hours]\nexample: /giveaway 50 24");
    return;
  }

  const credits = parseInt(match[1]);
  const hours = parseInt(match[2]);

  if (credits < 1 || credits > 1000) {
    await ctx.reply("credits must be between 1 and 1000.");
    return;
  }
  if (hours < 1 || hours > 168) {
    await ctx.reply("duration must be 1-168 hours.");
    return;
  }

  const giveawayId = crypto.randomUUID();
  const closesAt = Date.now() + hours * 60 * 60 * 1000;

  const keyboard = new InlineKeyboard().text("\u{1F3B0} Enter Giveaway", `giveaway_${giveawayId}`);

  await ctx.reply(
    `\u{1F381} CLAUDIA giveaway\n\nprize: ${credits} credits\nends in: ${hours} hours\n\nlinked wallet required to claim prize.\nwinners announced when timer ends.`,
    { reply_markup: keyboard }
  );

  await env.DB.prepare(
    `INSERT INTO tg_polls (id, chat_id, type, question, reward_credits, entries, status, created_by, created_at, closes_at)
     VALUES (?, ?, 'giveaway', ?, ?, '[]', 'active', ?, ?, ?)`
  ).bind(
    giveawayId,
    ctx.chat.id.toString(),
    `Giveaway: ${credits} credits`,
    credits,
    ctx.from.id.toString(),
    Date.now(),
    closesAt
  ).run();
}

export async function handleGiveawayEntry(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const data = ctx.callbackQuery?.data || "";
  const giveawayId = data.replace("giveaway_", "");
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const giveaway = await env.DB.prepare(
    "SELECT * FROM tg_polls WHERE id = ? AND type = 'giveaway' AND status = 'active'"
  ).bind(giveawayId).first<any>();

  if (!giveaway) {
    await ctx.answerCallbackQuery({ text: "giveaway ended or not found." });
    return;
  }

  if (giveaway.closes_at && Date.now() > giveaway.closes_at) {
    await ctx.answerCallbackQuery({ text: "giveaway has ended." });
    return;
  }

  const entries: string[] = JSON.parse(giveaway.entries || "[]");
  if (entries.includes(tgId)) {
    await ctx.answerCallbackQuery({ text: "you're already entered!" });
    return;
  }

  entries.push(tgId);
  await env.DB.prepare(
    "UPDATE tg_polls SET entries = ? WHERE id = ?"
  ).bind(JSON.stringify(entries), giveawayId).run();

  await ctx.answerCallbackQuery({ text: `entered! ${entries.length} total entries.` });
}
