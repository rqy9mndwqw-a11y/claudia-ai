/**
 * Commands that should only work in DM for privacy/spam reasons.
 * In groups, redirect to DM.
 */
const DM_ONLY_COMMANDS = new Set(["wallet", "credits", "tip", "invite", "analyze", "ask"]);

export function isDmOnly(command: string): boolean {
  return DM_ONLY_COMMANDS.has(command);
}

export async function redirectToDm(ctx: any, command: string): Promise<boolean> {
  if (ctx.chat?.type === "private") return false; // Already in DM

  if (isDmOnly(command)) {
    await ctx.reply(
      `use /${command} in DM for privacy.\n\ntap \u2192 https://t.me/CLAUDIA_wtf_bot`,
      { link_preview_options: { is_disabled: true } }
    );
    // Delete the user's message to protect their data
    try { await ctx.deleteMessage(); } catch {}
    return true;
  }

  return false;
}
