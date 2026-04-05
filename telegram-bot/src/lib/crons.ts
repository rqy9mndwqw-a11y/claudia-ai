import type { Env } from "../types.js";
import { addCredits } from "./api.js";
import { logEngagement, getLeaderboard } from "./db.js";
import { rankEmoji } from "./format.js";

const REWARD_TABLE = [500, 250, 150, 75, 75, 25, 25, 25, 25, 25];

/**
 * Daily: check referrals that are 7+ days old and mark active ones.
 */
export async function runDailyReferralCheck(env: Env): Promise<void> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  // Find pending referrals older than 24 hours
  const pending = await env.DB.prepare(
    `SELECT r.*, (SELECT COUNT(*) FROM tg_engagement WHERE tg_id = r.referred_tg_id) as activity
     FROM tg_referrals r
     WHERE r.is_active = 0 AND r.reward_credited = 0 AND r.joined_at < ?`
  ).bind(oneDayAgo).all<any>();

  for (const ref of pending.results || []) {
    // Need at least 3 engagement actions to count as active
    if (ref.activity < 3) continue;

    // Mark active
    await env.DB.prepare(
      "UPDATE tg_referrals SET is_active = 1 WHERE id = ?"
    ).bind(ref.id).run();

    // Credit referrer if they have a wallet
    if (ref.referrer_wallet) {
      const credited = await addCredits(env, ref.referrer_wallet, 10, `referral_${ref.referred_tg_id}`);
      if (credited) {
        await env.DB.prepare(
          "UPDATE tg_referrals SET reward_credited = 1 WHERE id = ?"
        ).bind(ref.id).run();
        await logEngagement(env.DB, ref.referrer_tg_id, ref.referrer_wallet, "referral", 15).catch(() => {});
      }
    }
  }

  console.log(`Referral check: ${pending.results?.length || 0} reviewed`);
}

/**
 * Weekly: post leaderboard to the group.
 * Requires CLAUDIA_GROUP_CHAT_ID env var.
 */
export async function runWeeklyLeaderboard(env: Env): Promise<void> {
  const chatId = env.CLAUDIA_GROUP_CHAT_ID;
  if (!chatId) {
    console.log("No CLAUDIA_GROUP_CHAT_ID set, skipping weekly post");
    return;
  }

  const leaders = await getLeaderboard(env.DB, 10);
  const totalPoints = leaders.reduce((sum, l) => sum + l.total, 0);

  // Minimum threshold: 3+ members with points AND 20+ total points
  if (leaders.length < 3 || totalPoints < 20) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "\u{1F4CA} leaderboard launching soon.\nbe the first to earn points.\n/scan /analyze /invite\n\napp.claudia.wtf",
        link_preview_options: { is_disabled: true },
      }),
    });
    return;
  }

  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekNum = Math.ceil(new Date().getDate() / 7);

  const lines = leaders.map((l, i) => {
    const name = l.display_name.startsWith("@") ? l.display_name : `@${l.display_name}`;
    return `${rankEmoji(i + 1)} ${name} \u2014 ${l.total} ${l.total === 1 ? "pt" : "pts"}`;
  });

  const message = [
    `\u{1F4CA} CLAUDIA community \u2014 weekly standings`,
    `${month} week ${weekNum}`,
    "",
    ...lines,
    "",
    "rewards drop 1st of next month.",
    "keep grinding \u{1F440}",
    "",
    "app.claudia.wtf/leaderboard",
  ].join("\n");

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      link_preview_options: { is_disabled: true },
    }),
  });
}

/**
 * Monthly: snapshot leaderboard, distribute rewards, reset.
 */
export async function runMonthlyRewards(env: Env): Promise<void> {
  // Get last month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = lastMonth.toISOString().slice(0, 7); // "2026-03"
  const monthLabel = lastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Get final standings for last month
  const leaders = await env.DB.prepare(
    `SELECT e.tg_id, t.wallet_address, t.display_name, t.username, SUM(e.points) as total
     FROM tg_engagement e
     LEFT JOIN telegram_users t ON e.tg_id = t.tg_id
     WHERE e.month = ?
     GROUP BY e.tg_id
     ORDER BY total DESC
     LIMIT 10`
  ).bind(monthStr).all<any>();

  const winners: string[] = [];

  for (let i = 0; i < (leaders.results?.length || 0); i++) {
    const leader = leaders.results![i];
    const reward = REWARD_TABLE[i] || 0;
    if (reward === 0) continue;

    // Snapshot to leaderboard table
    await env.DB.prepare(
      `INSERT INTO tg_leaderboard (id, tg_id, wallet_address, display_name, total_points, rank, reward_credits, month, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      leader.tg_id,
      leader.wallet_address || null,
      leader.display_name || leader.username || leader.tg_id,
      leader.total,
      i + 1,
      reward,
      monthStr,
      Date.now()
    ).run();

    // Credit rewards if wallet linked
    if (leader.wallet_address) {
      await addCredits(env, leader.wallet_address, reward, `monthly_reward_${monthStr}_rank${i + 1}`).catch(() => {});
    }

    const name = leader.display_name || leader.username || "anon";
    winners.push(`${rankEmoji(i + 1)} @${name} \u2014 ${reward} credits`);
  }

  // Post winners to group
  if (winners.length > 0) {
    const message = [
      `\u{1F3C6} CLAUDIA \u2014 ${monthLabel} winners`,
      "",
      "prizes have been dropped to linked wallets.",
      "",
      ...winners,
      "",
      "didn't win? new month starts now.",
      "link your wallet \u2192 /wallet 0x...",
      "",
      "app.claudia.wtf",
    ].join("\n");

    const chatId = env.CLAUDIA_GROUP_CHAT_ID;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, link_preview_options: { is_disabled: true } }),
      });
    }
  }

  console.log(`Monthly rewards: ${winners.length} winners for ${monthStr}`);
}

/**
 * ROTD Shortlist — runs at 8:00 PM UTC daily.
 * CLAUDIA picks top 3 submissions by quality_score and posts them
 * as individual messages for community 🔥 voting. Prevents spam by
 * curating instead of posting every submission immediately.
 */
export async function runROTDShortlist(env: Env): Promise<void> {
  const chatId = env.CLAUDIA_GROUP_CHAT_ID;
  if (!chatId) return;

  const cutoff = Math.floor(Date.now() / 1000) - 86400;

  // Top 3 submissions from last 24h by quality score, not yet posted
  const candidates = await env.DB.prepare(
    `SELECT * FROM roast_submissions
     WHERE submitted_at > ? AND selected_for_rotd = 0 AND telegram_message_id IS NULL
     ORDER BY quality_score DESC, abs(COALESCE(pnl_total, 0)) DESC
     LIMIT 3`
  ).bind(cutoff).all<any>();

  if (!candidates.results?.length) {
    console.log("ROTD shortlist: no candidates");
    return;
  }

  // Post header
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🔥 <b>Roast of the Day — Vote Now</b>\n\nCLAUDIA picked today's top ${candidates.results.length} roasts.\nReact 🔥 on your favorite. Winner announced 9AM UTC.\n\n⬇️`,
      parse_mode: "HTML",
    }),
  });

  // Post each candidate
  for (const candidate of candidates.results) {
    const roastPreview = (candidate.roast_text as string).split(/DEGEN SCORE/i)[0].trim();
    const preview = roastPreview.length > 350 ? roastPreview.slice(0, 350) + "..." : roastPreview;

    const msg = [
      `📨 <b>Candidate</b> — ${candidate.wallet_short}`,
      ``,
      preview,
      ``,
      `React 🔥 to vote for this one`,
    ].join("\n");

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      });

      if (tgRes.ok) {
        const tgData = (await tgRes.json()) as any;
        const messageId = tgData.result?.message_id;
        if (messageId) {
          // Seed the 🔥 reaction
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setMessageReaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reaction: [{ type: "emoji", emoji: "🔥" }],
            }),
          }).catch(() => {});

          await env.DB.prepare(
            `UPDATE roast_submissions SET telegram_message_id = ? WHERE id = ?`
          ).bind(messageId, candidate.id).run();
        }
      }
    } catch (err) {
      console.error("ROTD candidate post failed:", (err as Error).message);
    }
  }

  console.log(`ROTD shortlist: posted ${candidates.results.length} candidates`);
}

/**
 * ROTD Vote Tally — runs at 8:45 AM UTC daily.
 * Picks the submission with the highest 🔥 reaction count from last 24h.
 * Falls back to quality_score if no reactions.
 */
export async function runROTDVoteTally(env: Env): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const cutoff = Math.floor(Date.now() / 1000) - 86400;

  // Check if already selected today
  const existing = await env.DB.prepare(
    `SELECT id FROM roast_submissions WHERE rotd_date = ?`
  ).bind(today).first();

  if (existing) {
    console.log("ROTD already selected today");
    return;
  }

  // Pick by highest reaction count first
  let winner = await env.DB.prepare(
    `SELECT * FROM roast_submissions
     WHERE submitted_at > ? AND selected_for_rotd = 0 AND reaction_count > 0
     ORDER BY reaction_count DESC, quality_score DESC
     LIMIT 1`
  ).bind(cutoff).first<any>();

  // Fallback to quality score if no reactions
  if (!winner) {
    winner = await env.DB.prepare(
      `SELECT * FROM roast_submissions
       WHERE submitted_at > ? AND selected_for_rotd = 0
       ORDER BY quality_score DESC, abs(COALESCE(pnl_total, 0)) DESC
       LIMIT 1`
    ).bind(cutoff).first<any>();
  }

  if (!winner) {
    console.log("ROTD: no submissions in last 24h");
    return;
  }

  await env.DB.prepare(
    `UPDATE roast_submissions SET selected_for_rotd = 1, rotd_date = ? WHERE id = ?`
  ).bind(today, winner.id).run();

  console.log(`ROTD selected: ${winner.wallet_short} (reactions: ${winner.reaction_count}, quality: ${winner.quality_score})`);
}

/**
 * ROTD Post — runs at 9:00 AM UTC daily.
 * Posts the winner to X (@0xCLAUDIA_wtf) and Telegram (askclaudia).
 */
export async function runROTDPost(env: Env): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const appUrl = env.MAIN_APP_URL || "https://app.claudia.wtf";
  const secret = env.BOT_INTERNAL_SECRET;

  if (!secret) {
    console.log("ROTD post: no BOT_INTERNAL_SECRET");
    return;
  }

  const winner = await env.DB.prepare(
    `SELECT * FROM roast_submissions WHERE rotd_date = ? AND selected_for_rotd = 1`
  ).bind(today).first<any>();

  if (!winner) {
    console.log("ROTD post: no winner selected today");
    return;
  }

  // X posting disabled — account suspended
  // if (!winner.posted_to_x) {
  //   try {
  //     await fetch(`${appUrl}/api/roast/rotd/post-x`, {
  //       method: "POST",
  //       headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  //     });
  //   } catch (err) {
  //     console.error("ROTD X post failed:", (err as Error).message);
  //   }
  // }

  // Post winner announcement to Telegram
  if (!winner.posted_to_telegram) {
    const chatId = env.CLAUDIA_GROUP_CHAT_ID;
    if (chatId) {
      const roastText = (winner.roast_text as string).split(/DEGEN SCORE/i)[0].trim();
      const voteInfo = winner.reaction_count > 0 ? ` (${winner.reaction_count} 🔥 votes)` : "";

      const message = [
        `🏆 <b>Roast of the Day</b> — ${today}`,
        ``,
        `Winner by community vote${voteInfo}`,
        ``,
        `<code>${winner.wallet_short}</code>`,
        ``,
        roastText.length > 500 ? roastText.slice(0, 500) + "..." : roastText,
        ``,
        `<i>— CLAUDIA</i>`,
        ``,
        `<a href="https://roast.claudia.wtf">Get yours →</a>`,
      ].join("\n");

      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
        });

        await env.DB.prepare(
          `UPDATE roast_submissions SET posted_to_telegram = 1 WHERE id = ?`
        ).bind(winner.id).run();
      } catch (err) {
        console.error("ROTD Telegram post failed:", (err as Error).message);
      }
    }
  }

  console.log(`ROTD posted: ${winner.wallet_short}`);
}
