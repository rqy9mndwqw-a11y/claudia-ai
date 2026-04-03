"use client";

import Link from "next/link";
import type { AgentPublic } from "@/lib/marketplace/types";
import Badge from "./ui/Badge";
import { getAgentCreditCost, getTierInfo } from "@/lib/credits/agent-tiers";

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

// Category-specific hover glows
const CATEGORY_GLOW: Record<string, string> = {
  defi: "hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:border-green-500/20",
  trading: "hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:border-yellow-500/20",
  research: "hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-500/20",
  degen: "hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:border-pink-500/20",
  general: "hover:shadow-[0_0_20px_rgba(148,163,184,0.1)] hover:border-zinc-500/20",
};

const isClaudiaOfficial = (addr: string) =>
  addr === "0x0000000000000000000000000000000000000000";

export default function AgentCard({ agent }: AgentCardProps) {
  const glow = CATEGORY_GLOW[agent.category] || CATEGORY_GLOW.general;
  const isComingSoon = agent.status === "coming_soon";

  const Wrapper = isComingSoon ? "div" : Link;
  const wrapperProps = isComingSoon
    ? {}
    : { href: `/agents/${agent.id}` };

  return (
    <Wrapper
      {...wrapperProps as any}
      className={`relative bg-surface/50 rounded-xl border border-white/5
                 transition-all duration-300 p-4 flex flex-col gap-3 group ring-1 ring-transparent ${
                   isComingSoon ? "opacity-60 cursor-default" : `hover:bg-surface hover:-translate-y-px ${glow}`
                 }`}
    >
      {/* Coming Soon badge */}
      {isComingSoon && (
        <div className="absolute top-3 right-3 z-10">
          <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
            Coming Soon
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          {agent.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-heading font-bold text-white text-sm truncate group-hover:text-accent transition-colors">
              {agent.name}
            </h3>
            {isClaudiaOfficial(agent.creator_address) && (
              <div className="relative group/badge inline-flex">
                <img
                  src="/claudia-avatar.png"
                  alt=""
                  className="w-4 h-4 rounded-full ring-1 ring-white/10 opacity-60 group-hover:opacity-100 transition-opacity"
                />
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black text-[9px] text-white rounded opacity-0 group-hover/badge:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                  Official
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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

      {/* Example prompts */}
      {agent.example_prompts && agent.example_prompts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.example_prompts.slice(0, 2).map((prompt, i) => (
            <span key={i} className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded truncate max-w-[160px]">
              &ldquo;{prompt}&rdquo;
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      {(() => {
        const cost = getAgentCreditCost(agent.id);
        const tier = getTierInfo(agent.id);
        return (
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 text-[11px]">
            <span className={`${tier.color}`}>{tier.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">{agent.usage_count.toLocaleString()} chats</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">
                <span className="text-white font-bold">{cost}</span> cr/msg
              </span>
            </div>
          </div>
        );
      })()}
    </Wrapper>
  );
}

// ── Dense list view row ──

export function AgentRow({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03] transition-all border-b border-white/5"
    >
      {/* Category bar */}
      <div className={`w-0.5 h-6 rounded-full opacity-30 group-hover:opacity-100 transition-opacity ${
        agent.category === "defi" ? "bg-green-400" :
        agent.category === "trading" ? "bg-yellow-400" :
        agent.category === "research" ? "bg-blue-400" :
        agent.category === "degen" ? "bg-pink-400" : "bg-zinc-400"
      }`} />

      {/* Icon */}
      <span className="text-base flex-shrink-0">{agent.icon}</span>

      {/* Name + badge */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-sm text-white group-hover:text-accent transition-colors truncate">
          {agent.name}
        </span>
        {isClaudiaOfficial(agent.creator_address) && (
          <img src="/claudia-avatar.png" alt="" className="w-4 h-4 rounded-full border border-white/10 opacity-50 group-hover:opacity-100 group-hover:grayscale-0 grayscale transition-all" />
        )}
        <span className="text-[10px] text-zinc-700 uppercase tracking-wider hidden sm:inline ml-1">{agent.category}</span>
      </div>

      {/* Usage */}
      <div className="w-16 text-right hidden sm:block">
        <span className="text-[11px] font-mono text-zinc-500">{agent.usage_count.toLocaleString()}</span>
      </div>

      {/* Rating */}
      <div className="w-12 text-center hidden sm:block">
        <span className="text-[11px] text-green-400/70">+{agent.upvotes}</span>
      </div>

      {/* Cost */}
      <div className="w-14 text-right">
        <span className="text-[11px] font-bold text-white/70">{agent.cost_per_chat} <span className="text-zinc-600">cr</span></span>
      </div>
    </Link>
  );
}
