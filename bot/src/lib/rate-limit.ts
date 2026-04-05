const DAILY_FREE_LIMIT = 3;

export async function checkBotRateLimit(
  db: D1Database,
  telegramId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const user = await db.prepare(
    "SELECT daily_queries_used, daily_reset_at FROM telegram_users WHERE telegram_id = ?"
  ).bind(telegramId).first() as any;

  // New day or new user — reset
  if (!user || user.daily_reset_at < todayMs) {
    await db.prepare(`
      UPDATE telegram_users SET daily_queries_used = 0, daily_reset_at = ? WHERE telegram_id = ?
    `).bind(todayMs, telegramId).run();
    return { allowed: true, remaining: DAILY_FREE_LIMIT - 1 };
  }

  if (user.daily_queries_used >= DAILY_FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_FREE_LIMIT - user.daily_queries_used - 1 };
}

export async function incrementQueryCount(db: D1Database, telegramId: string): Promise<void> {
  await db.prepare(
    "UPDATE telegram_users SET daily_queries_used = daily_queries_used + 1 WHERE telegram_id = ?"
  ).bind(telegramId).run();
}
