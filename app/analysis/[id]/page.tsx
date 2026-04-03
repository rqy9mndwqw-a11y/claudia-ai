"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import TradingViewChart from "@/components/TradingViewChart";
import { useSessionToken } from "@/hooks/useSessionToken";
import { CLAUDIA_LOADING_MESSAGES, AGENT_INTROS } from "@/lib/claudia-voice";

interface AgentResult {
  agentId: string;
  agentName: string;
  agentIcon: string;
  analysis: string;
  success: boolean;
}

interface Synthesis {
  consensus: string;
  conflicts: string;
  recommendation: string;
  risk: string;
}

interface ClaudiaVerdict {
  score: number;
  verdict: string;
  risk: string;
  opinion: string;
}

interface FullAnalysis {
  analysisId: string;
  question: string;
  agents: AgentResult[];
  synthesis: Synthesis;
  claudiaVerdict: ClaudiaVerdict;
  creditsCharged: number;
}

// ── Agent color system ──

type AgentColor = {
  border: string;
  borderActive: string;
  text: string;
  bg: string;
  glow: string;
  chipBorder: string;
};

const AGENT_COLORS: Record<string, AgentColor> = {
  "claudia-token-analyst": {
    border: "border-l-agent-token/60",
    borderActive: "border-agent-token/50",
    text: "text-agent-token",
    bg: "bg-agent-token/10",
    glow: "shadow-glow-token",
    chipBorder: "border-agent-token/30",
  },
  "claudia-chart-reader": {
    border: "border-l-agent-chart/60",
    borderActive: "border-agent-chart/50",
    text: "text-agent-chart",
    bg: "bg-agent-chart/10",
    glow: "shadow-glow-chart",
    chipBorder: "border-agent-chart/30",
  },
  "claudia-risk-check": {
    border: "border-l-agent-risk/60",
    borderActive: "border-agent-risk/50",
    text: "text-agent-risk",
    bg: "bg-agent-risk/10",
    glow: "shadow-glow-risk",
    chipBorder: "border-agent-risk/30",
  },
};

const DEFAULT_COLORS: AgentColor = {
  border: "border-l-zinc-500/30",
  borderActive: "border-zinc-500/30",
  text: "text-zinc-400",
  bg: "bg-zinc-400/10",
  glow: "",
  chipBorder: "border-zinc-500/30",
};

function getAgentColors(agentId: string): AgentColor {
  return AGENT_COLORS[agentId] || DEFAULT_COLORS;
}

// ── HUD Icons (inline SVG) ──

function IconTarget({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="0" x2="8" y2="4" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="12" x2="8" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="3" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function IconPulse({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ── Price data node extraction and classification ──

type PriceNodeType = "entry" | "stoploss" | "current" | "generic";

interface PriceNode {
  text: string;
  type: PriceNodeType;
}

function classifyChip(chip: string, context: string): PriceNodeType {
  const lower = context.toLowerCase();
  const idx = lower.indexOf(chip.toLowerCase());
  const nearby = idx >= 0 ? lower.slice(Math.max(0, idx - 40), idx + chip.length + 40) : "";

  if (/entry|support|buy\s*(at|zone|near)|accumul/i.test(nearby)) return "entry";
  if (/stop.?loss|risk|floor|invalidat|protect|cut/i.test(nearby)) return "stoploss";
  if (/current|now|trading\s*at|price\s*is|live/i.test(nearby)) return "current";
  return "generic";
}

function extractPriceNodes(text: string): PriceNode[] {
  const nodes: PriceNode[] = [];
  const patterns: [RegExp, number][] = [
    [/RSI[\s(:]*[\d.]+/gi, 2],
    [/\$[\d,]+(?:\.[\d]+)?[MBK]?\s*TVL/gi, 1],
    [/[\d.]+%\s*APY/gi, 2],
    [/\$[\d,]+(?:\.[\d]+)?(?![MBK\s]*TVL)/g, 3],
    [/[\d.]+%(?!\s*APY)/g, 2],
  ];
  const seen = new Set<string>();
  for (const [pattern, max] of patterns) {
    const matches = text.match(pattern) || [];
    let count = 0;
    for (const match of matches) {
      if (seen.has(match) || count >= max) continue;
      seen.add(match);
      nodes.push({ text: match, type: classifyChip(match, text) });
      count++;
    }
  }
  return nodes.slice(0, 6);
}

function PriceNodeIcon({ type }: { type: PriceNodeType }) {
  if (type === "entry") return <IconTarget className="flex-shrink-0" />;
  if (type === "stoploss") return <IconShield className="flex-shrink-0" />;
  if (type === "current") return <IconPulse className="flex-shrink-0" />;
  return null;
}

// ── Contradiction + alignment ──

function getSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const bull = /bullish|buy|strong|upside|oversold|accumulate/i.test(lower);
  const bear = /bearish|sell|weak|downside|overbought|avoid|caution/i.test(lower);
  if (bull && !bear) return "bullish";
  if (bear && !bull) return "bearish";
  return "neutral";
}

function getConsensus(agents: AgentResult[]): "bullish" | "bearish" | "neutral" {
  const successful = agents.filter((a) => a.success);
  const sentiments = successful.map((a) => getSentiment(a.analysis));
  const bull = sentiments.filter((s) => s === "bullish").length;
  const bear = sentiments.filter((s) => s === "bearish").length;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

function isDivergent(agent: AgentResult, consensus: "bullish" | "bearish" | "neutral"): boolean {
  if (!agent.success || consensus === "neutral") return false;
  const s = getSentiment(agent.analysis);
  return s !== "neutral" && s !== consensus;
}

function getAlignmentStatus(agents: AgentResult[]): { label: string; color: string; description: string } {
  const successful = agents.filter((a) => a.success);
  if (successful.length < 2) return { label: "Limited Data", color: "text-zinc-400 border-zinc-400/30 bg-zinc-400/10", description: "not enough specialists completed" };

  const sentiments = successful.map((a) => getSentiment(a.analysis));
  const bull = sentiments.filter((s) => s === "bullish").length;
  const bear = sentiments.filter((s) => s === "bearish").length;
  const agreement = Math.max(bull, bear) / successful.length;

  if (agreement >= 0.8) return { label: "High Consensus", color: "text-green-400 border-green-400/30 bg-green-400/10", description: `${Math.round(agreement * 100)}% of specialists agree` };
  if (agreement >= 0.6) return { label: "Moderate Alignment", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", description: "specialists mostly agree with some variation" };
  return { label: "Mixed Signals", color: "text-red-400 border-red-400/30 bg-red-400/10", description: "specialists disagree \u2014 read each section carefully" };
}

// ── Badges ──

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? "text-green-400 border-green-500/30 bg-green-500/10"
    : score >= 4 ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${color}`}>
      <span className="font-heading font-bold text-xl">{score}/10</span>
      <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-70">Score</span>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const color = verdict === "Buy" ? "text-green-400 border-green-500/30 bg-green-500/10"
    : verdict === "Avoid" ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${color}`}>
      <span className="font-heading font-bold text-xl">{verdict}</span>
      <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-70">Verdict</span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const color = risk === "Low" ? "text-green-400 border-green-500/30 bg-green-500/10"
    : risk === "Very High" || risk === "High" ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${color}`}>
      <span className="font-heading font-bold text-lg">{risk}</span>
      <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-70">Risk</span>
    </div>
  );
}

// ── Markdown components ──

const mdComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: any) => <span className="font-semibold text-white">{children}</span>,
  ul: ({ children }: any) => <ul className="mt-2 space-y-1 list-none">{children}</ul>,
  li: ({ children }: any) => <li className="flex gap-2 text-zinc-300"><span className="text-accent mt-0.5">&#8250;</span><span>{children}</span></li>,
  h1: ({ children }: any) => <p className="font-semibold text-white">{children}</p>,
  h2: ({ children }: any) => <p className="font-semibold text-white">{children}</p>,
  h3: ({ children }: any) => <p className="font-semibold text-white mt-3 mb-1">{children}</p>,
  blockquote: ({ children }: any) => <div className="border-l-2 border-accent/30 pl-3 my-1">{children}</div>,
};

// ── Agent card ──

function AgentCard({ result, divergent }: { result: AgentResult; divergent: boolean }) {
  const colors = getAgentColors(result.agentId);
  const priceNodes = extractPriceNodes(result.analysis);

  return (
    <div
      className={`relative bg-gradient-to-b from-[#121217] to-[#13131a] border border-l-2 rounded-xl p-5 flex flex-col gap-3 overflow-y-auto max-h-[600px] ${
        divergent
          ? `${colors.borderActive} animate-pulse border-amber-500/30`
          : `border-white/5 ${colors.border}`
      }`}
    >
      {/* Divergent signal badge */}
      {divergent && (
        <div className="absolute top-2 right-2 px-2 py-0.5 text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-sm font-mono uppercase tracking-wider">
          Divergent Signal
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{result.agentIcon}</span>
          <span className="text-sm font-bold text-white flex-1">{result.agentName}</span>
          {!result.success && <span className="text-[10px] text-red-400/60">unavailable</span>}
        </div>
        {AGENT_INTROS[result.agentId] && (
          <p className="text-[11px] text-zinc-500 italic mt-1">{AGENT_INTROS[result.agentId]}</p>
        )}
      </div>

      {/* Price data nodes */}
      {priceNodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {priceNodes.map((node) => (
            <span
              key={node.text}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-[10px] ${colors.chipBorder} ${colors.bg} ${colors.text}`}
            >
              <PriceNodeIcon type={node.type} />
              {node.text}
            </span>
          ))}
        </div>
      )}

      {/* Analysis text */}
      <div className="text-[13px] text-zinc-300 leading-relaxed max-w-prose">
        <ReactMarkdown components={mdComponents}>
          {result.analysis}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── Main content ──

function AnalysisContent({ analysisId, sessionToken }: { analysisId: string; sessionToken: string | null }) {
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !analysisId) return;
    fetch(`/api/agents/full-analysis/${analysisId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json() as any)
      .then((data) => { if (data.error) setError(data.error); else setAnalysis(data); })
      .catch(() => setError("something broke. not my fault. try again."))
      .finally(() => setLoading(false));
  }, [analysisId, sessionToken]);

  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % CLAUDIA_LOADING_MESSAGES.length), 2000);
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
        <p className="text-zinc-300 text-sm font-heading animate-fade-in">{CLAUDIA_LOADING_MESSAGES[loadingMsgIdx]}</p>
        <p className="text-zinc-600 text-xs">running full analysis</p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-400 mb-4">{error || "analysis not found. probably nothing."}</p>
        <Link href="/scanner" className="text-accent hover:underline text-sm">Back to Scanner</Link>
      </div>
    );
  }

  const successCount = analysis.agents.filter((a) => a.success).length;
  const alignment = getAlignmentStatus(analysis.agents);
  const consensus = getConsensus(analysis.agents);

  // Extract ticker from the question for the chart
  const tickerMatch = analysis.question.match(/\b([A-Z]{2,10})\b/);
  const chartTicker = tickerMatch ? tickerMatch[1] : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header + Verdict — compact horizontal row */}
        <div>
          <Link href="/scanner" className="text-zinc-500 hover:text-white text-xs transition-colors">&larr; Back to Scanner</Link>
          <h1 className="font-heading font-bold text-white text-xl mt-3 mb-4">&ldquo;{analysis.question}&rdquo;</h1>

          <div className="bg-surface rounded-xl border border-accent/20 p-5 relative overflow-hidden">
            <div className="absolute top-2 right-4 opacity-[0.04]">
              <img src="/claudia-avatar.png" alt="" className="w-20 h-20" />
            </div>

            {/* Verdict row — horizontal on desktop */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
              <div className="flex-shrink-0">
                <img src="/claudia-avatar.png" alt="CLAUDIA" className="w-10 h-10 rounded-full border border-accent/30" />
              </div>

              <div className="flex gap-2 flex-wrap">
                <ScoreBadge score={analysis.claudiaVerdict.score} />
                <VerdictBadge verdict={analysis.claudiaVerdict.verdict} />
                <RiskBadge risk={analysis.claudiaVerdict.risk} />
              </div>

              <div className="flex-1 min-w-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${alignment.color}`}>{alignment.label}</span>
                <p className="text-zinc-500 text-[10px] mt-1">{successCount} specialists &middot; {alignment.description}</p>
              </div>
            </div>

            {/* Verdict quote */}
            <div className="bg-white/5 rounded-lg p-4 mt-4 relative z-10">
              <p className="text-zinc-200 text-sm leading-relaxed italic">
                &ldquo;{analysis.claudiaVerdict.opinion}&rdquo;
              </p>
              <p className="text-zinc-600 text-[10px] mt-2">not financial advice. but you already knew that.</p>
            </div>
          </div>
        </div>

        {/* Price chart */}
        {chartTicker && (
          <TradingViewChart symbol={chartTicker} interval="60" height={380} />
        )}

        {/* Bottom Line callout — high contrast, first thing you see after verdict */}
        {analysis.synthesis.recommendation && (
          <div className="bg-pink-500/10 border-l-4 border-pink-500 rounded-r-xl p-5">
            <p className="text-[10px] text-pink-400 uppercase tracking-widest font-bold mb-2">Bottom Line</p>
            <p className="text-white text-sm leading-relaxed font-medium">{analysis.synthesis.recommendation}</p>
          </div>
        )}

        {/* Agent Analysis — 3-column grid */}
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">Agent Analysis</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {analysis.agents.map((result) => (
              <AgentCard
                key={result.agentId}
                result={result}
                divergent={isDivergent(result, consensus)}
              />
            ))}
          </div>
        </div>

        {/* Synthesis */}
        <div className="bg-surface/50 rounded-xl border border-white/5 p-6 space-y-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">The Full Picture</p>

          {analysis.synthesis.consensus && (
            <div>
              <p className="text-[11px] text-zinc-500 font-bold mb-1">consensus</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{analysis.synthesis.consensus}</p>
            </div>
          )}
          {analysis.synthesis.conflicts && analysis.synthesis.conflicts !== "None" && (
            <div>
              <p className="text-[11px] text-zinc-500 font-bold mb-1">where it gets interesting</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{analysis.synthesis.conflicts}</p>
            </div>
          )}
          {analysis.synthesis.risk && (
            <div>
              <p className="text-[11px] text-zinc-500 font-bold mb-1">risk assessment</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{analysis.synthesis.risk}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5">
          <span className="text-zinc-600 text-xs">{analysis.creditsCharged} credits spent on this analysis</span>
          <span className="text-zinc-700 text-xs">&middot;</span>
          <span className="text-zinc-600 text-xs">not financial advice. obviously.</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { sessionToken } = useSessionToken();
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setAnalysisId(p.id));
  }, [params]);

  if (!analysisId) return null;

  return (
    <DashboardLayout>
      <TokenGate featureName="Full Analysis">
        <AnalysisContent analysisId={analysisId} sessionToken={sessionToken} />
      </TokenGate>
    </DashboardLayout>
  );
}
