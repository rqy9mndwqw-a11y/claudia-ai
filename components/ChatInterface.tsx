"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import YieldCard from "./YieldCard";
import ClaudiaAvatar from "./ClaudiaAvatar";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface YieldPool {
  pool: string;
  project: string;
  symbol: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number;
  stablecoin: boolean;
  poolMeta: string | null;
}

type AvatarState = "idle" | "thinking" | "responding" | "sideeye" | "smug";

export default function ChatInterface() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [yields, setYields] = useState<YieldPool[]>([]);
  const [yieldsLoading, setYieldsLoading] = useState(true);
  const [showYields, setShowYields] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [session, setSession] = useState<{ signature: string; message: string } | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch yields on mount
  useEffect(() => {
    fetch("/api/yields")
      .then((r) => r.json())
      .then((data) => {
        setYields(data.pools || []);
        setYieldsLoading(false);
      })
      .catch(() => setYieldsLoading(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Avatar state: side-eye when yields panel is open
  useEffect(() => {
    if (showYields && !loading) {
      setAvatarState("sideeye");
    } else if (!loading && messages.length === 0) {
      setAvatarState("idle");
    }
  }, [showYields, loading, messages.length]);

  // Avatar state: smug after responding, then back to idle
  useEffect(() => {
    if (!loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant") {
      setAvatarState("smug");
      const timer = setTimeout(() => setAvatarState("idle"), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, messages]);

  // Sign session on first use
  const ensureSession = useCallback(async (): Promise<{ signature: string; message: string } | null> => {
    if (session) return session;

    setSigningIn(true);
    try {
      const res = await fetch("/api/session");
      const { message } = await res.json();
      const signature = await signMessageAsync({ message });
      const s = { signature, message };
      setSession(s);
      setSigningIn(false);
      return s;
    } catch {
      setSigningIn(false);
      return null;
    }
  }, [session, signMessageAsync]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || !address) return;

      const userMsg: Message = { role: "user", content: text.trim().slice(0, 2000) };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");
      setLoading(true);
      setAvatarState("thinking");

      try {
        // Ensure we have a signed session
        const sess = await ensureSession();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updated.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            address,
            ...(sess && { signature: sess.signature, message: sess.message }),
          }),
        });

        const data = await res.json();

        if (res.status === 429) {
          setMessages([
            ...updated,
            { role: "assistant", content: "Chill. You're sending too many messages. I'm not going anywhere." },
          ]);
          return;
        }

        if (res.status === 403) {
          setMessages([
            ...updated,
            { role: "assistant", content: "Yeah, you don't have enough $CLAUDIA. Need at least 10,000. Go buy some and come back." },
          ]);
          return;
        }

        if (res.status === 401) {
          setSession(null); // Reset session, will re-sign next time
          setMessages([
            ...updated,
            { role: "assistant", content: "Your session expired. Send that again and I'll have you re-sign." },
          ]);
          return;
        }

        if (data.error) throw new Error(data.error);

        setMessages([...updated, { role: "assistant", content: data.reply }]);
        setAvatarState("smug");
      } catch {
        setMessages([
          ...updated,
          { role: "assistant", content: "Something broke. Not my fault. Try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, address, ensureSession]
  );

  const handleAskAboutYield = (
    project: string,
    symbol: string,
    apy: number
  ) => {
    sendMessage(
      `Tell me about ${project}'s ${symbol} pool at ${apy}% APY. Is it worth it? What are the risks?`
    );
    setShowYields(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Track typing for avatar
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (e.target.value.length > 0 && !loading && avatarState === "idle") {
      setAvatarState("sideeye"); // watching them type
    } else if (e.target.value.length === 0 && !loading) {
      setAvatarState("idle");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
            <img
              src="/claudia-avatar.png"
              alt="Claudia"
              className="w-8 h-8 object-cover object-top"
            />
          </div>
          <div>
            <h2 className="font-heading font-bold text-white text-sm">
              Claudia
            </h2>
            <p className="text-zinc-500 text-[10px]">
              {yieldsLoading
                ? "Loading yields..."
                : `${yields.length} Base pools tracked`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowYields(!showYields)}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
            showYields
              ? "bg-accent text-white"
              : "bg-surface-light text-zinc-400 hover:text-white"
          }`}
        >
          {showYields ? "Hide Yields" : "Browse Yields"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Claudia avatar — left panel on desktop */}
        <div className="hidden md:flex flex-col items-center justify-start w-48 border-r border-white/5 bg-surface/30 pt-6">
          <ClaudiaAvatar state={avatarState} />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-zinc-500 text-lg mb-2 font-heading">
                  What do you want to do with your money?
                </p>
                <p className="text-zinc-600 text-sm max-w-sm">
                  Ask about yields, protocols, strategies — or just say how much
                  you have and I&apos;ll tell you where to put it.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {[
                    "I have $1,000 in stablecoins. Where should I put it?",
                    "What's the safest yield on Base right now?",
                    "Compare the top 3 yield options for me",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-surface-light text-zinc-400 hover:text-white
                                 px-3 py-2 rounded-lg border border-white/5 hover:border-accent/20
                                 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {signingIn && (
                  <p className="text-coral text-xs mt-4 animate-pulse">
                    Sign the message in your wallet to verify ownership...
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`animate-fade-in flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent/20 text-white rounded-br-md"
                      : "bg-surface text-zinc-200 rounded-bl-md border border-white/5"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none
                                    prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
                                    prose-strong:text-accent prose-code:text-coral">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-surface rounded-2xl rounded-bl-md px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    <div
                      className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-end gap-2 bg-surface rounded-xl border border-white/10 focus-within:border-accent/30 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claudia anything about DeFi..."
                maxLength={2000}
                rows={1}
                className="flex-1 bg-transparent text-white text-sm px-4 py-3 resize-none
                           outline-none placeholder-zinc-600 max-h-32"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="bg-accent hover:bg-accent/80 disabled:opacity-30 disabled:hover:bg-accent
                           text-white px-4 py-2 m-1.5 rounded-lg transition-all text-sm font-medium"
              >
                Send
              </button>
            </div>
            <p className="text-zinc-600 text-[10px] mt-1.5 text-center">
              Claudia uses live DeFi data but is not financial advice. You sign
              all transactions yourself.
            </p>
          </div>
        </div>

        {/* Yields sidebar */}
        {showYields && (
          <div className="w-80 border-l border-white/5 overflow-y-auto p-3 space-y-2 hidden md:block">
            <h3 className="font-heading font-bold text-white text-sm mb-3 px-1">
              Top Yields on Base
            </h3>
            {yieldsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent" />
              </div>
            ) : (
              yields.slice(0, 15).map((y) => (
                <YieldCard
                  key={y.pool}
                  {...y}
                  onAsk={handleAskAboutYield}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
