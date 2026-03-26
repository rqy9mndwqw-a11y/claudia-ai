"use client";

import type { AgentPublic } from "@/lib/marketplace/types";
import Badge from "./ui/Badge";

interface AgentCardProps {
  agent: AgentPublic;
}

const CATEGORY_VARIANT: Record<string, "tag-stable" | "tag-il" | "tag-audit" | "tag-outlier" | "pick" | "neutral"> = {
  defi: "tag-stable",
  trading: "tag-il",
  research: "tag-audit",
  degen: "tag-outlier",
  general: "neutral",
};

export default function AgentCard({ agent }: AgentCardProps) {
  return (
    <a
      href={`/agents/${agent.id}`}
      className="bg-surface/50 rounded-xl border border-white/5
                 hover:bg-surface hover:border-white/10 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20
                 transition-all duration-200 p-4 flex flex-col gap-3 group"
    >
      {/* Header: icon + name + category */}
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          {agent.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-bold text-white text-sm truncate group-hover:text-accent transition-colors">
            {agent.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={CATEGORY_VARIANT[agent.category] ?? "neutral"}>
              {agent.category.toUpperCase()}
            </Badge>
            {agent.model === "premium" && (
              <Badge variant="pick">PREMIUM</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">
        {agent.description}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-auto pt-2 border-t border-white/5 text-[11px]">
        <span className="text-zinc-400">
          <span className="text-white font-bold">{agent.cost_per_chat}</span> credits
        </span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-400">
          <span className="text-white font-medium">{agent.usage_count.toLocaleString()}</span> chats
        </span>
        <span className="text-zinc-600">|</span>
        <span className="text-green-400/80">+{agent.upvotes}</span>
        <span className="text-red-400/60">-{agent.downvotes}</span>
        <span className="ml-auto text-zinc-600 text-[11px] truncate max-w-[80px]">
          {agent.creator_address === "0x0000000000000000000000000000000000000000"
            ? "by CLAUDIA"
            : `${agent.creator_address.slice(0, 6)}...${agent.creator_address.slice(-4)}`}
        </span>
      </div>
    </a>
  );
}
