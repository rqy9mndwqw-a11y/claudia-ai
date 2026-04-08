"use client";

import Link from "next/link";
import type { SuggestedAgent } from "@/lib/marketplace/types";

// CLAUDIA-voiced handoff messages — varies by suggesting agent's category
const HANDOFF_MESSAGES: Record<string, string[]> = {
  "claudia-defi-101": [
    "I've explained the basics. {agent} will take it from here.",
    "That's my piece on the theory. {agent} has the practical angle.",
  ],
  "claudia-yield-scout": [
    "I've mapped the yields. {agent} should weigh in too.",
    "Numbers don't lie, but {agent} has more context.",
  ],
  "claudia-gas-guru": [
    "Gas-wise you're covered. {agent} has thoughts on the rest.",
    "I've optimized the costs. {agent} can handle the strategy.",
  ],
  "claudia-chart-reader": [
    "The charts say what they say. {agent} would eat this alive though.",
    "I've read the candles. Now let {agent} add the risk angle.",
  ],
  "claudia-risk-check": [
    "Risk assessment done. {agent} can fill in the gaps.",
    "I've flagged the risks. {agent} will finish the job.",
  ],
  "claudia-token-analyst": [
    "Tokenomics covered. {agent} has a different lens on this.",
    "I've dissected the supply. {agent} should validate on-chain.",
  ],
  "claudia-onchain-sleuth": [
    "On-chain data checks out — or doesn't. Ask {agent} next.",
    "I've traced the wallets. {agent} has more to add.",
  ],
  "claudia-memecoin-radar": [
    "Degen intel delivered. But seriously, talk to {agent}.",
    "I've seen the vibes. {agent} has the reality check.",
  ],
  "claudia-airdrop-hunter": [
    "Airdrop strategy locked. {agent} has a related take.",
    "I've mapped the farms. {agent} knows the other side.",
  ],
  "claudia-base-guide": [
    "Base ecosystem covered. {agent} can go deeper.",
    "That's the Base overview. {agent} has specifics.",
  ],
  "claudia-security-check": [
    "Security audit done. {agent} can add more context.",
    "I've checked the locks. {agent} knows the rest.",
  ],
};

const DEFAULT_MESSAGES = [
  "This is {agent} territory. Want me to hand you off?",
  "I've said my piece. {agent} will finish the job.",
  "{agent} would have thoughts on this too.",
];

function getHandoffMessage(fromAgentId: string, toAgentName: string): string {
  const messages = HANDOFF_MESSAGES[fromAgentId] || DEFAULT_MESSAGES;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  return msg.replace("{agent}", toAgentName);
}

interface HandoffCardProps {
  fromAgentId: string;
  agent: SuggestedAgent;
}

export default function HandoffCard({ fromAgentId, agent }: HandoffCardProps) {
  const message = getHandoffMessage(fromAgentId, agent.name);

  return (
    <div className="flex justify-start animate-fade-in">
      <Link
        href={`/agents/${agent.id}`}
        className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 max-w-[85%]
                   hover:bg-accent/10 hover:border-accent/30 transition-all group"
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className="text-lg">{agent.icon}</span>
          <span className="text-xs font-bold text-accent group-hover:text-white transition-colors">
            {agent.name}
          </span>
          <span className="text-[10px] text-zinc-600">{agent.description}</span>
        </div>
        <p className="text-xs text-zinc-400 italic mb-2">&ldquo;{message}&rdquo;</p>
        <span className="text-[11px] font-bold text-accent group-hover:text-white transition-colors">
          Continue with {agent.name} &rarr;
        </span>
      </Link>
    </div>
  );
}
