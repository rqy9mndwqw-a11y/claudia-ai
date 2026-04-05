import type { TelegramUser } from "../types.js";

export async function getTelegramUser(db: D1Database, telegramId: string): Promise<TelegramUser | null> {
  return db.prepare("SELECT * FROM telegram_users WHERE telegram_id = ?").bind(telegramId).first() as any;
}

export async function linkWallet(
  db: D1Database,
  telegramId: string,
  username: string | null,
  walletAddress: string
): Promise<void> {
  await db.prepare(`
    INSERT INTO telegram_users (telegram_id, telegram_username, wallet_address, daily_queries_used, daily_reset_at, created_at)
    VALUES (?, ?, ?, 0, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      wallet_address = excluded.wallet_address,
      telegram_username = excluded.telegram_username
  `).bind(telegramId, username, walletAddress.toLowerCase(), Date.now(), Date.now()).run();
}

export async function getUserCredits(db: D1Database, walletAddress: string): Promise<number> {
  const user = await db.prepare("SELECT credits FROM users WHERE address = ?").bind(walletAddress.toLowerCase()).first() as any;
  return user?.credits ?? 0;
}

export async function getLatestScan(db: D1Database): Promise<any | null> {
  return db.prepare("SELECT * FROM market_scans ORDER BY scanned_at DESC LIMIT 1").first();
}
