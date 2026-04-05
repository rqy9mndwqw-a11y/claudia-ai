import type { TelegramUser } from "../types.js";

export async function getUser(db: D1Database, tgId: string): Promise<TelegramUser | null> {
  return db.prepare("SELECT * FROM telegram_users WHERE tg_id = ?").bind(tgId).first<TelegramUser>();
}

export async function upsertUser(
  db: D1Database,
  tgId: string,
  data: Partial<TelegramUser>
): Promise<void> {
  const now = Date.now();
  const existing = await getUser(db, tgId);

  if (existing) {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === "tg_id") continue;
      fields.push(`${k} = ?`);
      values.push(v);
    }
    fields.push("updated_at = ?");
    values.push(now);
    values.push(tgId);
    await db.prepare(`UPDATE telegram_users SET ${fields.join(", ")} WHERE tg_id = ?`).bind(...values).run();
  } else {
    await db.prepare(
      `INSERT INTO telegram_users (tg_id, wallet_address, username, display_name, joined_at, is_verified, free_queries_today, free_queries_reset, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`
    ).bind(
      tgId,
      data.wallet_address || null,
      data.username || null,
      data.display_name || null,
      now,
      data.is_verified || 0,
      now
    ).run();
  }
}

export async function logEngagement(
  db: D1Database,
  tgId: string,
  walletAddress: string | null,
  action: string,
  points: number
): Promise<void> {
  const now = Date.now();
  const month = new Date().toISOString().slice(0, 7); // "2026-04"
  await db.prepare(
    `INSERT INTO tg_engagement (id, tg_id, wallet_address, action, points, month, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), tgId, walletAddress, action, points, month, now).run();
}

export async function getDailyEngagementCount(db: D1Database, tgId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const result = await db.prepare(
    "SELECT COUNT(*) as cnt FROM tg_engagement WHERE tg_id = ? AND action = 'message' AND created_at >= ?"
  ).bind(tgId, todayStart.getTime()).first<{ cnt: number }>();
  return result?.cnt || 0;
}

export async function getMonthlyPoints(db: D1Database, tgId: string): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  const result = await db.prepare(
    "SELECT SUM(points) as total FROM tg_engagement WHERE tg_id = ? AND month = ?"
  ).bind(tgId, month).first<{ total: number }>();
  return result?.total || 0;
}

export async function getLeaderboard(db: D1Database, limit = 10): Promise<Array<{ tg_id: string; display_name: string; total: number }>> {
  const month = new Date().toISOString().slice(0, 7);
  const results = await db.prepare(
    `SELECT e.tg_id, t.display_name, t.username, SUM(e.points) as total
     FROM tg_engagement e
     LEFT JOIN telegram_users t ON e.tg_id = t.tg_id
     WHERE e.month = ? AND t.is_verified = 1
       AND t.username NOT IN ('CLAUDIA_wtf_bot', 'CLAUDIAwtf_bot', 'CLAUDIA_wtfx0', 'Telegram', 'GroupAnonymousBot')
     GROUP BY e.tg_id
     ORDER BY total DESC
     LIMIT ?`
  ).bind(month, limit).all<{ tg_id: string; display_name: string; username: string; total: number }>();
  return (results.results || []).map(r => ({
    tg_id: r.tg_id,
    display_name: r.username || r.display_name || r.tg_id,
    total: r.total,
  }));
}

export async function getReferralCount(db: D1Database, tgId: string): Promise<{ total: number; active: number }> {
  const total = await db.prepare(
    "SELECT COUNT(*) as cnt FROM tg_referrals WHERE referrer_tg_id = ?"
  ).bind(tgId).first<{ cnt: number }>();
  const active = await db.prepare(
    "SELECT COUNT(*) as cnt FROM tg_referrals WHERE referrer_tg_id = ? AND is_active = 1"
  ).bind(tgId).first<{ cnt: number }>();
  return { total: total?.cnt || 0, active: active?.cnt || 0 };
}

export async function createReferral(
  db: D1Database,
  referrerTgId: string,
  referredTgId: string,
  referredUsername: string | null
): Promise<void> {
  // Don't allow self-referral
  if (referrerTgId === referredTgId) return;
  // Check if already referred
  const existing = await db.prepare(
    "SELECT id FROM tg_referrals WHERE referred_tg_id = ?"
  ).bind(referredTgId).first();
  if (existing) return;

  const referrer = await getUser(db, referrerTgId);
  await db.prepare(
    `INSERT INTO tg_referrals (id, referrer_tg_id, referrer_wallet, referred_tg_id, referred_username, joined_at, is_active, reward_credited)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`
  ).bind(
    crypto.randomUUID(),
    referrerTgId,
    referrer?.wallet_address || null,
    referredTgId,
    referredUsername,
    Date.now()
  ).run();
}

export async function incrementQueries(db: D1Database, tgId: string): Promise<void> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  // Reset if new day
  await db.prepare(
    `UPDATE telegram_users
     SET free_queries_today = CASE WHEN free_queries_reset < ? THEN 1 ELSE free_queries_today + 1 END,
         free_queries_reset = ?
     WHERE tg_id = ?`
  ).bind(todayMs, todayMs, tgId).run();
}

export async function getQueriesToday(db: D1Database, tgId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const user = await getUser(db, tgId);
  if (!user) return 0;
  // If last reset was before today, they haven't used any today
  if (user.free_queries_reset < todayStart.getTime()) return 0;
  return user.free_queries_today;
}
