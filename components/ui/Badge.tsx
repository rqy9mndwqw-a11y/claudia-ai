"use client";

import { type ReactNode } from "react";

type BadgeVariant =
  | "chain-base"
  | "chain-ethereum"
  | "risk-safe"
  | "risk-moderate"
  | "risk-risky"
  | "risk-trash"
  | "tag-stable"
  | "tag-il"
  | "tag-outlier"
  | "tag-audit"
  | "pick"
  | "neutral";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
  title?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  "chain-base": "bg-blue-500/10 text-blue-400",
  "chain-ethereum": "bg-purple-500/10 text-purple-400",
  "risk-safe": "bg-green-500/10 text-green-400",
  "risk-moderate": "bg-yellow-500/10 text-yellow-400",
  "risk-risky": "bg-orange-500/10 text-orange-400",
  "risk-trash": "bg-red-500/10 text-red-400",
  "tag-stable": "bg-green-500/10 text-green-400",
  "tag-il": "bg-yellow-500/10 text-yellow-400",
  "tag-outlier": "bg-red-500/10 text-red-400",
  "tag-audit": "bg-blue-500/10 text-blue-400",
  pick: "bg-accent/15 text-accent",
  neutral: "bg-white/5 text-zinc-400",
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: "text-[11px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
};

export default function Badge({
  variant,
  size = "sm",
  children,
  className = "",
  title,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded font-bold leading-none whitespace-nowrap
                  ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}

/** Helper to get the right chain badge variant */
export function chainVariant(chain: string): "chain-base" | "chain-ethereum" {
  return chain === "Base" ? "chain-base" : "chain-ethereum";
}

/** Helper to get the right risk badge variant */
export function riskVariant(
  risk: string
): "risk-safe" | "risk-moderate" | "risk-risky" | "risk-trash" {
  const map: Record<string, "risk-safe" | "risk-moderate" | "risk-risky" | "risk-trash"> = {
    safe: "risk-safe",
    moderate: "risk-moderate",
    risky: "risk-risky",
    trash: "risk-trash",
  };
  return map[risk] ?? "risk-moderate";
}
