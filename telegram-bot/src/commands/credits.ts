import { getUser } from "../lib/db.js";
import { getCreditsBalance } from "../lib/api.js";
import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

export async function creditsCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "credits")) return;
  const env = ctx.env as Env;
  const tgId = ctx.from?.id?.toString();
  if (!tgId) return;

  const user = await getUser(env.DB, tgId);
  if (!user?.wallet_address) {
    await ctx.reply("link your wallet first: /wallet 0xYourAddress\n\nthen check your credits here.");
    return;
  }

  try {
    const credits = await getCreditsBalance(env, user.wallet_address);
    await ctx.reply(
      `your credits: ${credits}\n\neach credit = one agent query.\nevery purchase burns $CLAUDIA.\n\nbuy credits \u2192 app.claudia.wtf/credits`
    );
  } catch {
    await ctx.reply("couldn't check credits. try again.\n\napp.claudia.wtf/credits");
  }
}
