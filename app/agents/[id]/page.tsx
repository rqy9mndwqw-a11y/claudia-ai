"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import Badge from "@/components/ui/Badge";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useCredits } from "@/hooks/useCredits";
import HandoffCard from "@/components/HandoffCard";
import type { AgentPublic, SuggestedAgent } from "@/lib/marketplace/types";
import { getAgentCreditCost, getTierInfo } from "@/lib/credits/agent-tiers";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestedAgent?: SuggestedAgent;
}


function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-center gap-1.5 ml-9 bg-surface border border-white/5 rounded-xl rounded-bl-sm px-4 py-3">
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function AgentChat({ agentId, sessionToken }: { agentId: string; sessionToken: string | null }) {
  const [agent, setAgent] = useState<AgentPublic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const { credits, refresh: refreshCredits } = useCredits(sessionToken);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState("");

  const ANALYSIS_STEPS = [
    { at: 0, label: "routing to specialists...", pct: 5 },
    { at: 1500, label: "pulling live market data. obviously.", pct: 15 },
    { at: 3000, label: "agents analyzing in parallel.", pct: 30 },
    { at: 5000, label: "I've seen this chart before...", pct: 50 },
    { at: 7000, label: "cross-referencing findings.", pct: 65 },
    { at: 9000, label: "synthesizing. this is the part where I'm right.", pct: 80 },
    { at: 11000, label: "CLAUDIA forming her verdict.", pct: 90 },
    { at: 13000, label: "almost done. you're welcome in advance.", pct: 95 },
  ];

  useEffect(() => {
    if (!isRunningAnalysis) { setAnalysisProgress(0); return; }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of ANALYSIS_STEPS) {
      timers.push(setTimeout(() => {
        setAnalysisProgress(step.pct);
        setAnalysisStep(step.label);
      }, step.at));
    }
    return () => timers.forEach(clearTimeout);
  }, [isRunningAnalysis]);

  const handleFullAnalysis = useCallback(async () => {
    const lastUserMessage = messages.filter((m) => m.role === "user").at(-1)?.content;
    if (!lastUserMessage || !sessionToken || isRunningAnalysis) return;
    setIsRunningAnalysis(true);
    try {
      const res = await fetch("/api/agents/full-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ message: lastUserMessage, agentId, chatHistory: messages.slice(-10) }),
      });
      const data = await res.json() as any;
      if (data.analysisId) {
        router.push(`/analysis/${data.analysisId}`);
      } else {
        setError(data?.error || "Full analysis failed");
      }
    } catch {
      setError("Full analysis failed. Try again.");
    } finally {
      setIsRunningAnalysis(false);
    }
  }, [messages, sessionToken, agentId, isRunningAnalysis, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionToken) return;
    setAgentLoading(true);
    fetch(`/api/agents/${agentId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json() as any)
      .then((data: any) => {
        if (data.error) setError(data.error);
        else setAgent(data);
      })
      .catch(() => setError("Failed to load agent"))
      .finally(() => setAgentLoading(false));
  }, [agentId, sessionToken]);

  const sendMessage = useCallback(async (directMessage?: string) => {
    const text = directMessage || input.trim();
    if (!text || !sessionToken || isSending) return;

    const userMessage = text;
    setInput("");
    setError(null);

    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: Date.now() }]);
    setIsSending(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json().catch(() => null) as any;

      if (!res.ok) {
        if (res.status === 402) {
          setError("Insufficient credits. Buy more on the Credits page.");
        } else {
          setError(data?.error || "something broke. not my fault. try again.");
        }
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
        ...(data.suggested_agent && { suggestedAgent: data.suggested_agent }),
      }]);
      refreshCredits();
    } catch {
      setError("network error. try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [input, sessionToken, agentId, isSending, refreshCredits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (agentLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-surface rounded-2xl p-8 max-w-md border border-white/5 text-center">
          <p className="text-zinc-400 mb-4">{error || "Agent not found"}</p>
          <Link href="/agents" className="text-accent hover:underline text-sm">Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Full analysis overlay with progress */}
      {isRunningAnalysis && (
        <div className="absolute inset-0 z-30 bg-bg/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-8">
          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-zinc-600">analyzing</span>
              <span className="text-[10px] text-zinc-500 font-mono">{analysisProgress}%</span>
            </div>
          </div>

          {/* Step message */}
          <p key={analysisStep} className="text-zinc-300 text-sm font-heading animate-fade-in max-w-xs text-center">
            {analysisStep}
          </p>

          {/* Bouncing dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>

          <p className="text-zinc-600 text-xs">full analysis · multiple specialists</p>
        </div>
      )}

      {/* Compact agent header */}
      <div className="px-4 py-2 border-b border-white/5 bg-surface/20">
        <div className="flex items-center gap-3">
          <Link href="/agents" className="text-zinc-500 hover:text-white text-xs transition-colors flex-shrink-0">
            &larr;
          </Link>
          <span className="text-lg flex-shrink-0">{agent.icon}</span>
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-white text-sm">{agent.name}</span>
            <span className="text-zinc-600 text-[10px] ml-2 hidden sm:inline">{agent.description}</span>
          </div>
          <span className="text-[10px] text-zinc-600">{getAgentCreditCost(agentId)}cr/msg</span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            <span className="text-accent font-bold">{credits.toLocaleString()}</span> credits
          </span>
        </div>
        {agent.related_agents && agent.related_agents.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 ml-8">
            {agent.related_agents.map((ra) => (
              <Link
                key={ra.id}
                href={`/agents/${ra.id}`}
                className="text-[9px] text-zinc-600 hover:text-white bg-white/5 hover:bg-white/10
                           px-1.5 py-px rounded transition-colors"
              >
                {ra.icon} {ra.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5"
           style={{ background: "linear-gradient(180deg, #0E0E14 0%, #111118 100%)" }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
            <div className="text-5xl mb-4">{agent.icon}</div>
            <p className="text-zinc-400 text-sm font-heading font-bold mb-1">{agent.name}</p>
            <p className="text-zinc-600 text-xs mb-6">{getAgentCreditCost(agentId)} credit{getAgentCreditCost(agentId) > 1 ? "s" : ""} per message</p>

            <p className="text-zinc-500 text-xs italic mb-5">
              &ldquo;Go ahead, I&apos;m waiting.&rdquo;
            </p>

            {agent.example_prompts && agent.example_prompts.length > 0 && (
              <div className="space-y-2 w-full">
                <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-bold">Try one of these</p>
                {agent.example_prompts.slice(0, 4).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left text-xs text-zinc-400 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white
                               border border-white/5 hover:border-white/10
                               px-3 py-2 rounded-lg transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className="space-y-2 animate-fade-in">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[75%]">
                  <div className="bg-accent/15 text-white rounded-xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                  <p className="text-[9px] text-zinc-700 mt-1 text-right">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-start gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs mt-1">
                  {agent.icon}
                </div>
                <div className="max-w-[85%]">
                  <div className="bg-surface border border-white/5 rounded-xl rounded-bl-sm px-4 py-3 text-[13px] text-zinc-200 leading-relaxed">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <span className="font-semibold text-white">{children}</span>,
                        ul: ({ children }) => <ul className="mt-2 space-y-1 list-none">{children}</ul>,
                        ol: ({ children }) => <ol className="mt-2 space-y-1 list-none">{children}</ol>,
                        li: ({ children }) => <li className="flex gap-2 text-zinc-300"><span className="text-accent mt-0.5">›</span><span>{children}</span></li>,
                        h1: ({ children }) => <p className="font-semibold text-white">{children}</p>,
                        h2: ({ children }) => <p className="font-semibold text-white">{children}</p>,
                        h3: ({ children }) => <p className="font-semibold text-white mt-3 mb-1">{children}</p>,
                        blockquote: ({ children }) => <div className="border-l-2 border-accent/30 pl-3 my-1 text-zinc-300">{children}</div>,
                        code: ({ children }) => <code className="bg-white/5 px-1 py-0.5 rounded text-xs text-accent">{children}</code>,
                        a: ({ children }) => <span className="text-accent">{children}</span>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <p className="text-[9px] text-zinc-700 mt-1">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            )}
            {msg.suggestedAgent && (
              <HandoffCard fromAgentId={agentId} agent={msg.suggestedAgent} />
            )}
          </div>
        ))}

        {isSending && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center justify-between">
            <p className="text-red-400 text-xs">{error}</p>
            {error.includes("credits") && (
              <Link href="/credits" className="text-accent text-xs hover:underline font-bold">
                Buy Credits
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-white/10 bg-bg shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            maxLength={2000}
            disabled={isSending}
            className="flex-1 bg-surface border border-white/10 rounded-lg px-4 py-2.5
                       text-sm text-white placeholder-zinc-600 outline-none
                       focus:border-accent/30 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isSending}
            className="bg-accent hover:bg-accent/80 text-white px-5 py-2.5 rounded-lg
                       font-heading font-bold text-xs uppercase tracking-wider
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Send
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-zinc-700">{input.length}/2000</span>
          {messages.length > 0 && (
            <button
              onClick={handleFullAnalysis}
              disabled={isRunningAnalysis || isSending}
              className="text-[10px] text-zinc-500 hover:text-accent transition-colors disabled:opacity-30 flex items-center gap-1"
            >
              <span>&#9889;</span>
              {isRunningAnalysis ? "Analyzing..." : "Full Analysis — 6-10 credits"}
            </button>
          )}
          <span className="text-[10px] text-zinc-700">Enter to send</span>
        </div>
      </div>
    </div>
  );
}

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { sessionToken } = useSessionToken();
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setAgentId(p.id));
  }, [params]);

  if (!agentId) return null;

  return (
    <DashboardLayout>
      <TokenGate featureName="Agent Chat">
        <AgentChat agentId={agentId} sessionToken={sessionToken} />
      </TokenGate>
    </DashboardLayout>
  );
}
