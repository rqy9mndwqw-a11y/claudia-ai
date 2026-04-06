import { redirectToDm } from "../lib/dm-guard.js";
import type { Env } from "../types.js";

/**
 * /airdroplink — Generate a wallet-tied group invite link.
 * Users must have a wallet linked first (/wallet 0x...).
 * The invite link name embeds the wallet address for attribution.
 */
export async function airdropLinkCommand(ctx: any): Promise<void> {
  if (await redirectToDm(ctx, "airdroplink")) return;
  const env = ctx.env as Env;
  const chatId = env.CLAUDIA_GROUP_CHAT_ID;

  if (!chatId) {
    await ctx.reply("group not configured.");
    return;
  }

  const tgUser = ctx.tgUser;
  if (!tgUser?.wallet_address) {
    await ctx.reply(
      "link your wallet first:\n/wallet 0x...\n\nthen run /airdroplink again."
    );
    return;
  }

  const wallet = tgUser.wallet_address;
  const walletShort = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  try {
    const link = await ctx.api.createChatInviteLink(chatId, {
      name: `Airdrop — ${walletShort}`,
      creates_join_request: false,
      expire_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    });

    await ctx.reply(
      `your airdrop invite link:\n${link.invite_link}\n\n` +
        `share this link. when people join via your link, ` +
        `it's tied to your wallet (${walletShort}) for monthly $CLAUDIA airdrops.\n\n` +
        `no limit — share it as much as you want.`
    );

    console.log(
      JSON.stringify({
        event: "airdrop_link_created",
        wallet: walletShort,
        tgId: ctx.from?.id,
      })
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "airdrop_link_error",
        error: String(err),
      })
    );
    await ctx.reply("failed to create invite link. bot may need admin rights.");
  }
}
