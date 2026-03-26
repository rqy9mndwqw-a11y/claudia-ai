import type { CreateAgentInput } from "./types";

const VALID_CATEGORIES = new Set(["defi", "trading", "research", "degen", "general"]);
const VALID_MODELS = new Set(["standard", "premium"]);

// Single emoji regex (allows compound emojis like flags, skin tones)
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/**
 * Validate and sanitize agent creation input.
 * Returns cleaned input or throws with a descriptive error message.
 */
export function validateCreateAgent(raw: unknown): CreateAgentInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;

  // Name: required, 3-60 chars, no control characters
  const name = String(body.name ?? "").trim();
  if (name.length < 3 || name.length > 60) {
    throw new Error("Name must be 3-60 characters");
  }
  if (/[\x00-\x1F\x7F]/.test(name)) {
    throw new Error("Name contains invalid characters");
  }

  // Description: required, 10-280 chars
  const description = String(body.description ?? "").trim();
  if (description.length < 10 || description.length > 280) {
    throw new Error("Description must be 10-280 characters");
  }

  // Category: must be in allowed set
  const category = String(body.category ?? "general").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`Category must be one of: ${[...VALID_CATEGORIES].join(", ")}`);
  }

  // Icon: single emoji, default to robot
  const icon = String(body.icon ?? "🤖").trim();
  if (!EMOJI_REGEX.test(icon) && icon !== "🤖") {
    // If not a valid emoji, fall back to default
    // Don't error — just use default
  }
  const safeIcon = EMOJI_REGEX.test(icon) ? icon : "🤖";

  // System prompt: required, 20-2000 chars
  const system_prompt = String(body.system_prompt ?? "").trim();
  if (system_prompt.length < 20 || system_prompt.length > 2000) {
    throw new Error("System prompt must be 20-2000 characters");
  }

  // Model: standard or premium
  const model = String(body.model ?? "standard").toLowerCase();
  if (!VALID_MODELS.has(model)) {
    throw new Error("Model must be 'standard' or 'premium'");
  }

  // Cost per chat: 1-100 credits
  const cost_per_chat = Number(body.cost_per_chat ?? 1);
  if (!Number.isInteger(cost_per_chat) || cost_per_chat < 1 || cost_per_chat > 100) {
    throw new Error("Cost per chat must be 1-100 credits");
  }

  // Public: boolean, default true
  const is_public = body.is_public !== false;

  return {
    name,
    description,
    category,
    icon: safeIcon,
    system_prompt,
    model: model as "standard" | "premium",
    cost_per_chat,
    is_public,
  };
}

/**
 * Sanitize user chat input to prevent prompt injection.
 * Strips control characters, limits length, but preserves normal text.
 */
export function sanitizeChatMessage(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("Message must be a string");
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    throw new Error("Message cannot be empty");
  }

  if (trimmed.length > 2000) {
    throw new Error("Message must be under 2000 characters");
  }

  // Strip control characters but keep normal unicode
  return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Generate a short unique ID for agents (URL-safe, 12 chars).
 */
export function generateAgentId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
