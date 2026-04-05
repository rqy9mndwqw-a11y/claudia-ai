import type { Env } from "../types.js";

async function isAdmin(ctx: any): Promise<boolean> {
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ["creator", "administrator"].includes(member.status);
  } catch {
    return false;
  }
}

export async function pollCommand(ctx: any): Promise<void> {
  const env = ctx.env as Env;

  if (ctx.chat?.type === "private") {
    await ctx.reply("polls can only be created in the group.");
    return;
  }

  if (!(await isAdmin(ctx))) {
    await ctx.reply("admin only.");
    return;
  }

  const text = ctx.message?.text || "";
  const content = text.replace(/^\/poll\s*/i, "").trim();
  const parts = content.split("|").map((s: string) => s.trim()).filter(Boolean);

  if (parts.length < 3) {
    await ctx.reply("usage: /poll Question? | Option 1 | Option 2 | Option 3");
    return;
  }

  const question = parts[0];
  const options = parts.slice(1);

  try {
    const msg = await ctx.replyWithPoll(question, options, { is_anonymous: false });

    await env.DB.prepare(
      `INSERT INTO tg_polls (id, chat_id, tg_poll_id, type, question, options, status, created_by, created_at)
       VALUES (?, ?, ?, 'poll', ?, ?, 'active', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      ctx.chat.id.toString(),
      msg.poll?.id || "",
      question,
      JSON.stringify(options),
      ctx.from.id.toString(),
      Date.now()
    ).run();
  } catch {
    await ctx.reply("failed to create poll.");
  }
}
