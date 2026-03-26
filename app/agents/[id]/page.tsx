"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import AppHeader from "@/components/ui/AppHeader";
import TokenGate from "@/components/TokenGate";
import Badge from "@/components/ui/Badge";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useCredits } from "@/hooks/useCredits";
import type { AgentPublic } from "@/lib/marketplace/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch agent details
  useEffect(() => {
    if (!sessionToken) return;
    setAgentLoading(true);
    fetch(`/api/agents/${agentId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json() as any)
      .then((data: any) => {
        if (data.error) {
          setError(data.error);
        } else {
          setAgent(data);
        }
      })
      .catch(() => setError("Failed to load agent"))
      .finally(() => setAgentLoading(false));
  }, [agentId, sessionToken]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionToken || isSending) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Optimistic: add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
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
          setError(data?.error || "Failed to send message");
        }
        // Remove optimistic message on error
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      // Add assistant reply
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      refreshCredits();
    } catch {
      setError("Network error. Try again.");
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
          <a href="/agents" className="text-accent hover:underline text-sm">Back to Marketplace</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Agent info header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 bg-surface/20">
        <a href="/agents" className="text-zinc-500 hover:text-white text-xs transition-colors flex-shrink-0">
          &larr;
        </a>
        <div className="text-xl flex-shrink-0">{agent.icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-bold text-white text-sm truncate">{agent.name}</h2>
          <p className="text-zinc-500 text-[11px] truncate">{agent.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant="neutral" size="md">{agent.cost_per_chat} credits/msg</Badge>
          <span className="text-xs text-zinc-500">
            Balance: <span className="text-accent font-bold">{credits.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">{agent.icon}</div>
            <p className="text-zinc-400 text-sm mb-1">Start chatting with {agent.name}</p>
            <p className="text-zinc-600 text-xs">{agent.cost_per_chat} credits per message</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent/15 text-white rounded-br-sm"
                  : "bg-surface border border-white/5 text-zinc-300 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface border border-white/5 rounded-xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border border-accent border-t-transparent" />
                <span className="text-xs text-zinc-500 italic">thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center justify-between">
            <p className="text-red-400 text-xs">{error}</p>
            {error.includes("credits") && (
              <a href="/credits" className="text-accent text-xs hover:underline font-bold">
                Buy Credits
              </a>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-5 py-3 border-t border-white/5 bg-surface/20">
        <div className="flex gap-3">
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
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="bg-accent hover:bg-accent/80 text-white px-5 py-2.5 rounded-lg
                       font-heading font-bold text-xs uppercase tracking-wider
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Send
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-zinc-600">
            {input.length}/2000
          </span>
          <span className="text-[11px] text-zinc-600">
            Enter to send, Shift+Enter for newline
          </span>
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
    <main className="h-screen flex flex-col bg-bg">
      <AppHeader />
      <TokenGate featureName="Agent Chat">
        <AgentChat agentId={agentId} sessionToken={sessionToken} />
      </TokenGate>
    </main>
  );
}
