"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSessionToken } from "@/hooks/useSessionToken";

interface Message {
  role: "user" | "assistant";
  content: string;
  agentTriggered?: string;
  creditsUsed?: number;
}

// Context-aware follow-up prompts based on last assistant message
function getSuggestedFollowups(messages: Message[]): string[] {
  if (messages.length === 0) {
    return [
      "What agents do you have?",
      "Scan the market",
      "Analyze BTC",
      "How do credits work?",
    ];
  }

  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return [];

  const content = last.content.toLowerCase();

  // After a chart/technical analysis
  if (last.agentTriggered?.includes("chart")) {
    return ["Check the risk", "Token fundamentals", "Scan the market"];
  }

  // After risk analysis
  if (last.agentTriggered?.includes("risk")) {
    return ["Analyze the chart", "What about ETH?", "Best yields right now"];
  }

  // After token analysis
  if (last.agentTriggered?.includes("token")) {
    return ["Check the risk", "Analyze the chart", "Security check"];
  }

  // After a scan
  if (content.includes("scanned") || content.includes("pairs")) {
    return ["Analyze BTC", "Analyze ETH", "Analyze SOL"];
  }

  // After explaining credits/agents
  if (content.includes("credit") || content.includes("agent")) {
    return ["Scan the market", "Analyze BTC", "Best yields"];
  }

  // After yield analysis
  if (last.agentTriggered?.includes("yield")) {
    return ["Check the risk", "What about stablecoins?", "Scan the market"];
  }

  // After security check
  if (last.agentTriggered?.includes("security")) {
    return ["Analyze the chart", "Token fundamentals", "Scan the market"];
  }

  // Generic follow-ups
  return ["Scan the market", "Analyze BTC", "How do credits work?"];
}

export default function FloatingWidget() {
  const { sessionToken } = useSessionToken();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-minimize when navigating to a different page
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened and after sending
  useEffect(() => {
    if (isOpen && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, isLoading, messages.length]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading || !sessionToken) return;

    setInput("");
    setHasInteracted(true);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat/widget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as any;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || data.error || "something broke.",
          agentTriggered: data.agentTriggered,
          creditsUsed: data.creditsUsed,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "couldn't reach the server. try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionToken) return null;

  const followups = getSuggestedFollowups(messages);

  return (
    <>
      {/* Chat bubble button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30 flex items-center justify-center transition-all hover:scale-105 hover:shadow-accent/50 ${
            !hasInteracted ? "animate-pulse" : ""
          }`}
          title="Chat with CLAUDIA"
        >
          <img
            src="/claudia-avatar.png"
            alt="CLAUDIA"
            className="w-10 h-10 rounded-full"
          />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] max-h-[80vh] bg-bg border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden sm:w-[380px] sm:h-[520px] max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface/50">
            <div className="flex items-center gap-2.5">
              <img
                src="/claudia-avatar.png"
                alt="CLAUDIA"
                className="w-7 h-7 rounded-full"
              />
              <div>
                <p className="text-white text-sm font-heading font-bold">CLAUDIA</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-zinc-500 text-[10px]">online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <img
                  src="/claudia-avatar.png"
                  alt="CLAUDIA"
                  className="w-12 h-12 rounded-full opacity-60"
                />
                <p className="text-zinc-500 text-xs text-center">
                  ask me anything about the platform,<br />or tell me what to analyze.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {followups.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-[11px] text-zinc-400 bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : "order-0"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-start gap-2">
                      <img
                        src="/claudia-avatar.png"
                        alt=""
                        className="w-5 h-5 rounded-full mt-1 flex-shrink-0"
                      />
                      <div>
                        <div className="bg-surface border border-white/5 rounded-xl rounded-tl-sm px-3 py-2">
                          <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                        {msg.agentTriggered && (
                          <p className="text-[10px] text-zinc-600 mt-1 ml-1 font-mono">
                            ran {msg.agentTriggered.replace("claudia-", "")}
                            {msg.creditsUsed ? ` · ${msg.creditsUsed} credits` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.role === "user" && (
                    <div className="bg-accent/20 border border-accent/20 rounded-xl rounded-tr-sm px-3 py-2">
                      <p className="text-zinc-200 text-sm">{msg.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <img
                  src="/claudia-avatar.png"
                  alt=""
                  className="w-5 h-5 rounded-full mt-1"
                />
                <div className="bg-surface border border-white/5 rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Follow-up suggestions — always visible after messages */}
          {messages.length > 0 && !isLoading && followups.length > 0 && (
            <div className="px-3 py-2 border-t border-white/5 flex gap-1.5 overflow-x-auto">
              {followups.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-[10px] text-zinc-500 bg-white/5 hover:bg-white/10 border border-white/5 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/5 bg-surface/30">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="ask CLAUDIA..."
                disabled={isLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-accent/30 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="bg-accent hover:bg-accent/80 disabled:opacity-30 text-white px-3 py-2.5 rounded-xl transition-all flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
