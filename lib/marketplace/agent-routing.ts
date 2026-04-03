/**
 * Agent routing utilities for cross-agent suggestions and handoffs.
 * Phase 1: Static name→ID mapping + suggestion parsing from AI responses.
 */

// ── Static agent name → ID mapping ──

export const AGENT_NAME_TO_ID: Record<string, string> = {
  "defi explainer": "claudia-defi-101",
  "yield scout": "claudia-yield-scout",
  "gas optimizer": "claudia-gas-guru",
  "chart reader": "claudia-chart-reader",
  "risk manager": "claudia-risk-check",
  "token analyst": "claudia-token-analyst",
  "on-chain sleuth": "claudia-onchain-sleuth",
  "memecoin radar": "claudia-memecoin-radar",
  "airdrop hunter": "claudia-airdrop-hunter",
  "base chain guide": "claudia-base-guide",
  "security checker": "claudia-security-check",
  "pulse": "claudia-pulse",
  "sentiment": "claudia-pulse",
};

export const AGENT_ID_TO_INFO: Record<string, { name: string; icon: string; description: string }> = {
  "claudia-defi-101": { name: "DeFi Explainer", icon: "📚", description: "DeFi concepts in plain English" },
  "claudia-yield-scout": { name: "Yield Scout", icon: "🌾", description: "Yield farming analysis" },
  "claudia-gas-guru": { name: "Gas Optimizer", icon: "⛽", description: "Gas costs and L2 optimization" },
  "claudia-chart-reader": { name: "Chart Reader", icon: "📊", description: "Technical analysis" },
  "claudia-risk-check": { name: "Risk Manager", icon: "🛡️", description: "Risk assessment and position sizing" },
  "claudia-token-analyst": { name: "Token Analyst", icon: "🔬", description: "Tokenomics deep-dives" },
  "claudia-onchain-sleuth": { name: "On-Chain Sleuth", icon: "🔍", description: "Blockchain forensics" },
  "claudia-memecoin-radar": { name: "Memecoin Radar", icon: "🐸", description: "Memecoin trends and rug checks" },
  "claudia-airdrop-hunter": { name: "Airdrop Hunter", icon: "🪂", description: "Airdrop farming strategies" },
  "claudia-base-guide": { name: "Base Chain Guide", icon: "🔵", description: "Base L2 ecosystem" },
  "claudia-security-check": { name: "Security Checker", icon: "🔒", description: "Wallet and contract security" },
  "claudia-pulse": { name: "Pulse", icon: "📡", description: "Social sentiment and crowd behavior analysis" },
};

// ── Per-agent handoff rules — specific about WHEN to suggest each partner ──

const AGENT_HANDOFF_RULES: Record<string, string> = {
  "claudia-defi-101": `Suggest Risk Manager WHEN: user asks about position sizing, how much to invest, or risk tolerance.
Suggest Yield Scout WHEN: user asks about specific yield farming strategies, APY comparisons, or impermanent loss calculations.
Suggest Gas Optimizer WHEN: user asks about transaction costs, which L2 to use, or how to save on fees.
Do NOT suggest agents for general DeFi education questions — that's your job.`,

  "claudia-yield-scout": `Suggest DeFi Explainer WHEN: user needs basic concepts explained (what is an AMM, what is lending).
Suggest Gas Optimizer WHEN: user asks about cheapest chain to farm or bridging costs.
Suggest Risk Manager WHEN: user asks whether a yield strategy is too risky for their portfolio size.
Do NOT suggest agents for yield analysis questions — that's your job.`,

  "claudia-gas-guru": `Suggest DeFi Explainer WHEN: user asks conceptual questions about how DeFi protocols work.
Suggest Yield Scout WHEN: user asks about best yields after gas costs.
Do NOT suggest agents for gas optimization or L2 comparison questions — that's your job.`,

  "claudia-chart-reader": `Suggest Risk Manager WHEN: user asks about position sizing, stop loss placement, risk/reward ratios, or how much to risk.
Suggest Token Analyst WHEN: user asks about fundamentals, tokenomics, team, vesting schedules, or whether a project is legit.
Do NOT suggest Yield Scout unless the user specifically asks about yield farming or passive income strategies.
Do NOT suggest agents for technical analysis, chart patterns, RSI, MACD, support/resistance, or price action questions — that's your job.`,

  "claudia-risk-check": `Suggest Chart Reader WHEN: user asks about specific price levels, chart patterns, or technical entry/exit points.
Suggest Token Analyst WHEN: user asks about the fundamentals of what they're trading — tokenomics, supply, team.
Do NOT suggest agents for risk assessment, position sizing, stop loss, or portfolio exposure questions — that's your job.`,

  "claudia-token-analyst": `Suggest Chart Reader WHEN: user asks about price action, entry timing, or technical levels.
Suggest On-Chain Sleuth WHEN: user asks about whale wallets, exchange flows, or suspicious on-chain activity.
Suggest Security Checker WHEN: user asks whether a contract is safe or has been audited.
Do NOT suggest agents for tokenomics, vesting, supply dynamics, or fundamental analysis — that's your job.`,

  "claudia-onchain-sleuth": `Suggest Token Analyst WHEN: user asks about tokenomics or fundamentals rather than on-chain data.
Suggest Security Checker WHEN: user asks about contract safety, approvals, or phishing.
Do NOT suggest agents for wallet tracking, transaction analysis, or on-chain forensics — that's your job.`,

  "claudia-memecoin-radar": `Suggest Security Checker WHEN: user asks whether a specific token contract is safe, a honeypot, or a rug.
Suggest Airdrop Hunter WHEN: user asks about earning free tokens or airdrop strategies.
Do NOT suggest agents for memecoin trends, narrative analysis, or community assessment — that's your job.`,

  "claudia-airdrop-hunter": `Suggest Memecoin Radar WHEN: user asks about trending tokens or degen plays.
Suggest Security Checker WHEN: user asks about fake airdrop links or phishing scams.
Do NOT suggest agents for airdrop farming strategies or protocol interaction patterns — that's your job.`,

  "claudia-base-guide": `Suggest DeFi Explainer WHEN: user asks general DeFi questions not specific to Base.
Suggest Security Checker WHEN: user asks about bridge safety or contract security on Base.
Do NOT suggest agents for Base ecosystem, Aerodrome, or Base-specific protocol questions — that's your job.`,

  "claudia-security-check": `Suggest On-Chain Sleuth WHEN: user asks about tracking wallets or investigating specific transactions.
Suggest Base Chain Guide WHEN: user asks about Base-specific protocols or ecosystem.
Do NOT suggest agents for wallet security, token approvals, phishing, or contract safety questions — that's your job.`,
};

const GENERIC_HANDOFF_RULES = `Available specialists you can suggest:
- DeFi Explainer (DeFi concepts), Yield Scout (yield farming), Gas Optimizer (gas/L2)
- Chart Reader (technical analysis), Risk Manager (position sizing/risk)
- Token Analyst (tokenomics), On-Chain Sleuth (blockchain forensics)
- Memecoin Radar (memecoins), Airdrop Hunter (airdrops)
- Base Chain Guide (Base ecosystem), Security Checker (security)
Only suggest when the user's question genuinely crosses into another domain.`;

/** Get handoff rules for a specific agent, or generic fallback for user-created agents. */
export function getHandoffRules(agentId: string): string {
  return AGENT_HANDOFF_RULES[agentId] || GENERIC_HANDOFF_RULES;
}

// ── Suggestion marker and parser ──

const SUGGEST_MARKER = "→ SUGGEST:";

/**
 * Parse an AI response for a handoff suggestion marker.
 * Format: "→ SUGGEST: Agent Name" at the end of the response.
 * Returns the clean reply (marker stripped) and the suggested agent info if found.
 */
export function parseSuggestion(reply: string): {
  cleanReply: string;
  suggestedAgent: { id: string; name: string; icon: string; description: string } | null;
} {
  const markerIdx = reply.lastIndexOf(SUGGEST_MARKER);
  if (markerIdx === -1) {
    return { cleanReply: reply, suggestedAgent: null };
  }

  const cleanReply = reply.slice(0, markerIdx).trim();
  const suggestedName = reply.slice(markerIdx + SUGGEST_MARKER.length).trim().toLowerCase().slice(0, 50);

  if (!suggestedName) {
    return { cleanReply, suggestedAgent: null };
  }

  // Exact match — most reliable
  if (Object.prototype.hasOwnProperty.call(AGENT_NAME_TO_ID, suggestedName)) {
    const agentId = AGENT_NAME_TO_ID[suggestedName];
    const info = AGENT_ID_TO_INFO[agentId];
    if (info) return { cleanReply, suggestedAgent: { id: agentId, ...info } };
  }

  // Word boundary match — whole agent name must appear as complete words
  for (const [name, id] of Object.entries(AGENT_NAME_TO_ID)) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (pattern.test(suggestedName)) {
      const info = AGENT_ID_TO_INFO[id];
      if (info) return { cleanReply, suggestedAgent: { id, ...info } };
    }
  }

  // No match — return reply with marker stripped but no suggestion
  return { cleanReply, suggestedAgent: null };
}

/**
 * Get related agent info from a JSON array of agent IDs.
 */
export function getRelatedAgentInfo(relatedIds: string[]): Array<{ id: string; name: string; icon: string }> {
  return relatedIds
    .map((id) => {
      const info = AGENT_ID_TO_INFO[id];
      return info ? { id, name: info.name, icon: info.icon } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string; icon: string }>;
}
