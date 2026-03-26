import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UserRow, AgentRow, ChatMessageRow, CreditTransactionRow } from "./types";

/**
 * Get the D1 database binding from the Cloudflare request context.
 * Uses @opennextjs/cloudflare (NOT @cloudflare/next-on-pages — that's for Pages, not OpenNext Workers).
 */
export function getDB(): D1Database {
  try {
    const { env } = getCloudflareContext();
    return (env as any).DB as D1Database;
  } catch {
    throw new Error("D1 database not available — are you running on Cloudflare Workers?");
  }
}

/**
 * Get the Workers AI binding from the Cloudflare request context.
 */
export function getAI(): Ai {
  try {
    const { env } = getCloudflareContext();
    return (env as any).AI as Ai;
  } catch {
    throw new Error("Workers AI not available — are you running on Cloudflare Workers?");
  }
}

// ── User operations ──

export async function getOrCreateUser(db: D1Database, address: string): Promise<UserRow> {
  const lower = address.toLowerCase();

  // Try to get existing user
  const existing = await db.prepare("SELECT * FROM users WHERE address = ?").bind(lower).first<UserRow>();
  if (existing) return existing;

  // Create new user
  await db.prepare(
    "INSERT INTO users (address, tier, credits) VALUES (?, 'browse', 0)"
  ).bind(lower).run();

  const created = await db.prepare("SELECT * FROM users WHERE address = ?").bind(lower).first<UserRow>();
  if (!created) throw new Error("Failed to create user");
  return created;
}

export async function updateUserTier(db: D1Database, address: string, tier: UserRow["tier"]): Promise<void> {
  await db.prepare(
    "UPDATE users SET tier = ?, updated_at = datetime('now') WHERE address = ?"
  ).bind(tier, address.toLowerCase()).run();
}

// ── Agent operations ──

export async function listPublicAgents(
  db: D1Database,
  options: { category?: string; search?: string; limit?: number; offset?: number }
): Promise<AgentRow[]> {
  const { category, search, limit = 50, offset = 0 } = options;
  let sql = "SELECT * FROM agents WHERE status = 'active' AND is_public = 1";
  const params: any[] = [];

  if (category && category !== "all") {
    sql += " AND category = ?";
    params.push(category);
  }

  if (search) {
    sql += " AND (name LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY usage_count DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db.prepare(sql).bind(...params).all<AgentRow>();
  return result.results;
}

export async function getAgentById(db: D1Database, id: string): Promise<AgentRow | null> {
  return db.prepare("SELECT * FROM agents WHERE id = ? AND status != 'deleted'").bind(id).first<AgentRow>();
}

export async function createAgent(db: D1Database, agent: {
  id: string;
  creator_address: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  system_prompt: string;
  model: string;
  cost_per_chat: number;
  is_public: number;
}): Promise<void> {
  await db.prepare(
    `INSERT INTO agents (id, creator_address, name, description, category, icon, system_prompt, model, cost_per_chat, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    agent.id,
    agent.creator_address.toLowerCase(),
    agent.name,
    agent.description,
    agent.category,
    agent.icon,
    agent.system_prompt,
    agent.model,
    agent.cost_per_chat,
    agent.is_public,
  ).run();
}

export async function incrementAgentUsage(db: D1Database, agentId: string): Promise<void> {
  await db.prepare(
    "UPDATE agents SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(agentId).run();
}

// ── Chat history ──

export async function getChatHistory(
  db: D1Database,
  agentId: string,
  userAddress: string,
  limit: number = 20
): Promise<ChatMessageRow[]> {
  const result = await db.prepare(
    `SELECT * FROM chat_messages
     WHERE agent_id = ? AND user_address = ?
     ORDER BY created_at DESC LIMIT ?`
  ).bind(agentId, userAddress.toLowerCase(), limit).all<ChatMessageRow>();

  // Return in chronological order
  return result.results.reverse();
}

export async function saveChatMessage(
  db: D1Database,
  agentId: string,
  userAddress: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await db.prepare(
    "INSERT INTO chat_messages (agent_id, user_address, role, content) VALUES (?, ?, ?, ?)"
  ).bind(agentId, userAddress.toLowerCase(), role, content).run();
}

// ── Atomic credit operations ──

/**
 * Atomically deduct credits from user and credit the agent creator.
 * Uses D1 batch (all-or-nothing execution).
 * Returns the user's new balance, or throws if insufficient credits.
 */
export async function deductCreditsAtomic(
  db: D1Database,
  userAddress: string,
  creatorAddress: string,
  amount: number,
  agentId: string
): Promise<{ userBalance: number; creatorBalance: number }> {
  const lower = userAddress.toLowerCase();
  const creatorLower = creatorAddress.toLowerCase();

  // Platform takes 20%, creator gets 80%
  const creatorShare = Math.floor(amount * 0.8);

  // Check current balance first
  const user = await db.prepare("SELECT credits FROM users WHERE address = ?").bind(lower).first<{ credits: number }>();
  if (!user || user.credits < amount) {
    throw new Error(`Insufficient credits: have ${user?.credits ?? 0}, need ${amount}`);
  }

  const newUserBalance = user.credits - amount;

  // Get creator's current balance for the transaction log
  const creator = await db.prepare("SELECT credits FROM users WHERE address = ?").bind(creatorLower).first<{ credits: number }>();
  const newCreatorBalance = (creator?.credits ?? 0) + creatorShare;

  // Atomic batch: all statements execute together or none do
  await db.batch([
    // Deduct from user
    db.prepare(
      "UPDATE users SET credits = credits - ?, total_spent = total_spent + ?, updated_at = datetime('now') WHERE address = ? AND credits >= ?"
    ).bind(amount, amount, lower, amount),

    // Credit the creator (80%)
    db.prepare(
      "UPDATE users SET credits = credits + ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE address = ?"
    ).bind(creatorShare, creatorShare, creatorLower),

    // Log user's spend
    db.prepare(
      "INSERT INTO credit_transactions (address, amount, type, reference_id, balance_after) VALUES (?, ?, 'chat_spend', ?, ?)"
    ).bind(lower, -amount, agentId, newUserBalance),

    // Log creator's earning
    db.prepare(
      "INSERT INTO credit_transactions (address, amount, type, reference_id, balance_after) VALUES (?, ?, 'creator_earn', ?, ?)"
    ).bind(creatorLower, creatorShare, agentId, newCreatorBalance),

    // Increment agent usage count
    db.prepare(
      "UPDATE agents SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(agentId),
  ]);

  return { userBalance: newUserBalance, creatorBalance: newCreatorBalance };
}

/**
 * Add credits to a user's balance (for purchases).
 * Atomic: updates balance + logs transaction.
 */
export async function addCreditsAtomic(
  db: D1Database,
  address: string,
  amount: number,
  type: "purchase" | "bonus" | "refund",
  referenceId: string
): Promise<number> {
  const lower = address.toLowerCase();

  // Ensure user exists
  await getOrCreateUser(db, lower);

  const user = await db.prepare("SELECT credits FROM users WHERE address = ?").bind(lower).first<{ credits: number }>();
  const newBalance = (user?.credits ?? 0) + amount;

  await db.batch([
    db.prepare(
      "UPDATE users SET credits = credits + ?, updated_at = datetime('now') WHERE address = ?"
    ).bind(amount, lower),

    db.prepare(
      "INSERT INTO credit_transactions (address, amount, type, reference_id, balance_after) VALUES (?, ?, ?, ?, ?)"
    ).bind(lower, amount, type, referenceId, newBalance),
  ]);

  return newBalance;
}
