// ── Environment bindings (available via process.env on CF Workers with OpenNext) ──
// For D1 and AI, we need to access them through the Cloudflare request context.

export interface Env {
  DB: D1Database;
  AI: Ai;
  SESSION_SECRET: string;
  GROQ_API_KEY: string;
}

// ── Database row types ──

export interface UserRow {
  address: string;
  tier: "browse" | "use" | "create" | "whale";
  credits: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  creator_address: string;
  name: string;
  description: string;
  category: "defi" | "trading" | "research" | "degen" | "general";
  icon: string;
  system_prompt: string;
  model: "standard" | "premium";
  cost_per_chat: number;
  is_public: number; // SQLite uses 0/1 for booleans
  usage_count: number;
  upvotes: number;
  downvotes: number;
  status: "active" | "suspended" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: number;
  agent_id: string;
  user_address: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface CreditTransactionRow {
  id: number;
  address: string;
  amount: number;
  type: "purchase" | "chat_spend" | "creator_earn" | "refund" | "bonus";
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

// ── API response types ──

export interface AgentPublic {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  model: string;
  cost_per_chat: number;
  creator_address: string;
  usage_count: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export interface CreateAgentInput {
  name: string;
  description: string;
  category: string;
  icon: string;
  system_prompt: string;
  model: "standard" | "premium";
  cost_per_chat: number;
  is_public: boolean;
}

export interface ChatInput {
  message: string;
}

// ── API Response Types ──

export interface AgentListResponse {
  agents: AgentPublic[];
  count: number;
  offset: number;
  limit: number;
}

export interface AgentDetailResponse extends AgentPublic {
  system_prompt?: string;
}

export interface CreateAgentResponse {
  id: string;
  name: string;
  message: string;
}

export interface CreditsResponse {
  credits: number;
  tier: string;
  total_spent: number;
  total_earned: number;
  address: string;
  created_at: string;
  transactions: CreditTransaction[];
}

export interface CreditTransaction {
  id: number;
  amount: number;
  type: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface ChatResponse {
  reply: string;
  agent_id: string;
  agent_name: string;
  model: string;
  credits_used: number;
  credits_remaining: number;
}

export interface PurchaseResponse {
  credits_added: number;
  new_balance: number;
  claudia_spent: number;
  payment_token: string;
  tx_hash: string;
}

export interface SessionNonceResponse {
  message: string;
  nonce: string;
}

export interface SessionVerifyResponse {
  token: string;
  address: string;
}

export interface ApiError {
  error: string;
  [key: string]: unknown;
}

// ── Tier thresholds (in $CLAUDIA tokens) ──

export const TIER_THRESHOLDS = {
  browse: 100_000,
  use: 100_000,
  create: 500_000,
  whale: 1_000_000,
} as const;

// ── Model mapping ──

export const MODEL_IDS = {
  standard: "@cf/meta/llama-3.1-8b-instruct-fast",
  premium: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
} as const;

// ── Credit costs per model ──

export const MODEL_CREDIT_MULTIPLIER = {
  standard: 1,
  premium: 5, // premium model costs 5x base credits
} as const;
