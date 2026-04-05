export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  BOT_INTERNAL_SECRET: string;
  MAIN_APP_URL: string;
}

export interface TelegramUser {
  telegram_id: string;
  telegram_username: string | null;
  wallet_address: string | null;
  daily_queries_used: number;
  daily_reset_at: number;
  created_at: number;
}
