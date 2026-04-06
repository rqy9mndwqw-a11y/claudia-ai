import { createReferralFromWallet } from "../lib/db.js";
import type { Env } from "../types.js";

/**
 * Handle chat_member updates for invite link attribution ONLY.
 * This does NOT grant permissions — that stays in handleVerifyCallback.
 *
 * When a user joins via a wallet-tied invite link (name format:
 * "Airdrop — 0x1234...5678"), we extract the wallet and log the referral.
 */
export async function handleInviteAttribution(ctx: any): Promise<void> {
  const env = ctx.env as Env;
  const update = ctx.chatMember;

  // Only handle new joins
  if (
    update.new_chat_member.status !== "member" ||
    update.old_chat_member.status === "member"
  ) {
    return;
  }

  // Extract invite link info — Telegram provides this on chat_member events
  const inviteLinkName = update.invite_link?.name as string | undefined;
  if (!inviteLinkName || !inviteLinkName.startsWith("Airdrop")) return;

  // Parse wallet from link name: "Airdrop — 0x1234...5678"
  const walletMatch = inviteLinkName.match(/0x[a-fA-F0-9]+/);
  if (!walletMatch) return;

  const referrerWallet = walletMatch[0];
  const newMemberId = update.new_chat_member.user.id.toString();
  const newMemberUsername = update.new_chat_member.user.username || null;

  try {
    await createReferralFromWallet(
      env.DB,
      referrerWallet,
      newMemberId,
      newMemberUsername
    );
    console.log(
      JSON.stringify({
        event: "invite_attribution_recorded",
        referrerWallet,
        newMemberId,
        inviteLink: update.invite_link?.invite_link || null,
      })
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "invite_attribution_error",
        referrerWallet,
        newMemberId,
        error: String(err),
      })
    );
  }
}
