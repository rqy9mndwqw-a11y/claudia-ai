/**
 * Agent credit tier system — single source of truth for all agent pricing.
 * Import getAgentCreditCost() everywhere. Never hardcode credit values.
 */

export type AgentTier = 1 | 2 | 3;

export const AGENT_CREDIT_TIERS: Record<string, AgentTier> = {
  // Tier 1 — 1 credit — informational agents (no DeepSeek R1)
  "claudia-defi-101": 1,
  "claudia-base-guide": 1,
  "claudia-gas-guru": 1,
  "claudia-airdrop-hunter": 1,

  // Tier 2 — 2 credits — analysis agents (DeepSeek R1 + Nemotron)
  "claudia-chart-reader": 2,
  "claudia-risk-check": 2,
  "claudia-yield-scout": 2,
  "claudia-token-analyst": 2,
  "claudia-security-check": 2,
  "claudia-onchain-sleuth": 2,
  "claudia-pulse": 2,

  // Tier 3 — 3 credits — data-heavy agents (multiple data sources + AI)
  "claudia-memecoin-radar": 3,
};

/** Get credit cost for a single agent message. Defaults to 1 if agent not found. */
export function getAgentCreditCost(agentId: string): number {
  return AGENT_CREDIT_TIERS[agentId] ?? 1;
}

/** Get credit cost for a full multi-agent analysis. 2 credits per agent. */
export function getFullAnalysisCost(agentCount: number): number {
  return Math.min(Math.max(agentCount * 2, 6), 10); // min 6 (3 agents), max 10 (5 agents)
}

export const FULL_ANALYSIS_MIN_COST = 6;
export const FULL_ANALYSIS_MAX_COST = 10;

/** Tier display info for UI. */
export function getTierInfo(agentId: string): { label: string; color: string } {
  const cost = getAgentCreditCost(agentId);
  if (cost === 1) return { label: "Basic", color: "text-zinc-400" };
  if (cost === 2) return { label: "Analysis", color: "text-blue-400" };
  return { label: "Intelligence", color: "text-purple-400" };
}
