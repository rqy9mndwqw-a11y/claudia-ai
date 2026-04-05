import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { upsertUser, createReferral } from "../lib/db.js";
import type { Env } from "../types.js";

/**
 * Handle new member joining the group.
 * Sends captcha button, restricts user until verified.
 */
export async function handleNewMember(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const newMembers = ctx.message?.new_chat_members;
  if (!newMembers?.length) return;

  for (const member of newMembers) {
    if (member.is_bot) continue;

    const tgId = member.id.toString();

    // Save user record
    await upsertUser(env.DB, tgId, {
      username: member.username || null,
      display_name: member.first_name || null,
      is_verified: 0,
    }).catch(() => {});

    // Restrict until verified
    try {
      await ctx.restrictChatMember(member.id, {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
      });
    } catch {}

    // Send captcha
    const keyboard = new InlineKeyboard().text("\u2705 I'm human, let me in", "verify");
    await ctx.reply(
      `\u{1F44B} welcome${member.first_name ? ` ${member.first_name}` : ""}.\n\nbefore you dive in \u2014 tap the button below to verify you're human. you have 60 seconds.`,
      { reply_markup: keyboard }
    );

    // Auto-restrict after 60 seconds if not verified
    // Note: CF Workers can't do setTimeout > 30s, so we rely on
    // the restriction already being in place. The user stays restricted
    // until they click verify.
  }
}

/**
 * Check if a /start command has a referral parameter.
 * Format: /start ref_[referrerTgId]
 */
export async function handleStartReferral(ctx: any, startParam: string): Promise<void> {
  const env = ctx.env as Env;
  if (!startParam.startsWith("ref_")) return;

  const referrerTgId = startParam.replace("ref_", "");
  const referredTgId = ctx.from?.id?.toString();
  if (!referredTgId || referrerTgId === referredTgId) return;

  await createReferral(
    env.DB,
    referrerTgId,
    referredTgId,
    ctx.from?.username || null
  ).catch(() => {});
}
