import type { Context } from "grammy";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  BOT_INTERNAL_SECRET: string;
  MAIN_APP_URL: string;
  ALCHEMY_WEBHOOK_SECRET: string;
  CLAUDIA_GROUP_CHAT_ID: string;
}

export interface TelegramUser {
  tg_id: string;
  wallet_address: string | null;
  username: string | null;
  display_name: string | null;
  joined_at: number;
  is_verified: number;
  free_queries_today: number;
  free_queries_reset: number;
  updated_at: number;
}

export interface BotContext extends Context {
  env: Env;
  tgUser?: TelegramUser;
}

export type Tier = "free" | "dashboard" | "unlimited";

export interface TierInfo {
  tier: Tier;
  balance: number;
  dailyLimit: number;
  queriesUsed: number;
  queriesRemaining: number;
}
