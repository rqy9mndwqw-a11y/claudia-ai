"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import AgentCard from "@/components/AgentCard";
import ClaudiaCharacter from "@/components/ClaudiaCharacter";
import { useSessionToken } from "@/hooks/useSessionToken";
import { GATE_THRESHOLDS } from "@/lib/gate-thresholds";
import type { AgentPublic } from "@/lib/marketplace/types";

// ── Approved creator allowlist (env var, comma-separated) ──
const APPROVED_CREATORS = (process.env.NEXT_PUBLIC_APPROVED_CREATORS || "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

const CATEGORIES = [
  { value: "defi", label: "DeFi" },
  { value: "trading", label: "Trading" },
  { value: "research", label: "Research" },
  { value: "degen", label: "Degen" },
  { value: "general", label: "General" },
];

// ── Coming Soon screen for non-approved wallets ──

function ComingSoon({ sessionToken }: { sessionToken: string | null }) {
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!sessionToken || !contact.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ contact: contact.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as any;
        throw new Error(data?.error || "Failed to submit");
      }

      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <ClaudiaCharacter
          imageSrc="/claudia-avatar.png"
          mood="skeptical"
          message="I'm reviewing applications personally. Standards are high."
          className="mx-auto"
        />

        <div className="bg-surface rounded-2xl border border-white/5 p-8 space-y-4">
          <div className="text-3xl">🔒</div>
          <h2 className="font-heading font-bold text-white text-xl">
            Agent Creator Access — Coming Soon
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Creator applications will open soon.
            Hold <span className="text-accent font-bold">{GATE_THRESHOLDS.marketplace_create.toLocaleString()} $CLAUDIA</span> to qualify.
          </p>

          {submitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-400 font-bold text-sm">Application submitted</p>
              <p className="text-zinc-500 text-xs mt-1">We&apos;ll reach out when creator access opens.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-zinc-500 text-xs">Get notified when creator access opens:</p>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email or Telegram handle"
                maxLength={200}
                className="w-full bg-bg border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                           placeholder-zinc-600 outline-none focus:border-accent/30 transition-colors"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                onClick={handleApply}
                disabled={submitting || !contact.trim()}
                className="w-full py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider
                           bg-accent hover:bg-accent/80 text-white transition-all
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Notify Me"}
              </button>
            </div>
          )}
        </div>

        <a href="/agents" className="text-zinc-500 hover:text-white text-xs transition-colors inline-block">
          &larr; Back to Marketplace
        </a>
      </div>
    </div>
  );
}

// ── Create form (only shown to approved creators) ──

function CreateForm({ sessionToken }: { sessionToken: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("defi");
  const [icon, setIcon] = useState("🤖");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState<"standard" | "premium">("standard");
  const [costPerChat, setCostPerChat] = useState(1);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!sessionToken) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name, description, category, icon,
          system_prompt: systemPrompt,
          model, cost_per_chat: costPerChat,
          is_public: isPublic,
        }),
      });

      const data = await res.json().catch(() => null) as any;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create agent");
      }

      router.push(`/agents/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionToken, name, description, category, icon, systemPrompt, model, costPerChat, isPublic, router]);

  // Live preview data
  const preview: AgentPublic = {
    id: "preview",
    name: name || "Agent Name",
    description: description || "Agent description will appear here...",
    category,
    icon,
    model,
    cost_per_chat: costPerChat,
    creator_address: "0x0000000000000000000000000000000000000000",
    usage_count: 0,
    upvotes: 0,
    downvotes: 0,
    status: "active",
    created_at: new Date().toISOString(),
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/agents" className="text-zinc-500 hover:text-white text-xs transition-colors">
            &larr; Back to Marketplace
          </a>
          <h1 className="font-heading font-bold text-white text-xl">Create Agent</h1>
        </div>

        <div className="flex gap-8 flex-col lg:flex-row">
          {/* Form */}
          <div className="flex-1 space-y-5">
            {/* Name */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Name</label>
                <span className={`text-[11px] ${name.length > 55 ? "text-red-400" : "text-zinc-600"}`}>
                  {name.length}/60
                </span>
              </div>
              <input
                value={name} onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="DeFi Yield Scanner"
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                           placeholder-zinc-600 outline-none focus:border-accent/30 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">Description</label>
                <span className={`text-[11px] ${description.length > 260 ? "text-red-400" : "text-zinc-600"}`}>
                  {description.length}/280
                </span>
              </div>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                placeholder="Scans DeFi protocols on Base for yield opportunities..."
                rows={2}
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                           placeholder-zinc-600 outline-none focus:border-accent/30 transition-colors resize-none"
              />
            </div>

            {/* Category + Icon row */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">Category</label>
                <select
                  value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                             outline-none focus:border-accent/30 transition-colors"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">Icon</label>
                <input
                  value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                  className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                             text-center outline-none focus:border-accent/30 transition-colors"
                />
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">System Prompt</label>
                <span className={`text-[11px] ${systemPrompt.length > 1900 ? "text-red-400" : "text-zinc-600"}`}>
                  {systemPrompt.length}/2000
                </span>
              </div>
              <textarea
                value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value.slice(0, 2000))}
                placeholder="You are a DeFi analyst. You scan yield farming opportunities on Base chain. Be direct, opinionated, and data-driven..."
                rows={6}
                className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white
                           placeholder-zinc-600 outline-none focus:border-accent/30 transition-colors resize-none
                           font-mono text-xs leading-relaxed"
              />
              <p className="text-[11px] text-zinc-600 mt-1">
                This defines your agent&apos;s personality. Users won&apos;t see it directly.
              </p>
            </div>

            {/* Model + Cost row */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">Model</label>
                <div className="flex gap-2">
                  {(["standard", "premium"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setModel(m)}
                      className={`flex-1 text-xs px-3 py-2 rounded-lg transition-colors font-medium ${
                        model === m
                          ? "bg-accent text-white"
                          : "bg-surface-light text-zinc-400 hover:text-white"
                      }`}
                    >
                      {m === "standard" ? "Standard (8B)" : "Premium (70B)"}
                    </button>
                  ))}
                </div>
                {model === "premium" && (
                  <p className="text-[11px] text-accent mt-1">Requires Whale tier (1M $CLAUDIA)</p>
                )}
              </div>
              <div className="w-32">
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">
                  Cost ({costPerChat} credits)
                </label>
                <input
                  type="range" min="1" max="50" value={costPerChat}
                  onChange={(e) => setCostPerChat(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  isPublic ? "bg-accent" : "bg-surface-light"
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  isPublic ? "left-5" : "left-0.5"
                }`} />
              </button>
              <span className="text-xs text-zinc-400">
                {isPublic ? "Public — listed in marketplace" : "Private — only accessible by direct link"}
              </span>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name || !description || !systemPrompt}
              className={`w-full py-3 rounded-xl font-heading font-bold text-sm uppercase tracking-wider transition-all ${
                isSubmitting
                  ? "bg-accent/20 text-accent animate-pulse cursor-wait"
                  : "bg-accent hover:bg-accent/80 text-white disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Creating..." : "Create Agent"}
            </button>
          </div>

          {/* Live preview */}
          <div className="lg:w-80 flex-shrink-0">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold mb-3">Preview</p>
            <div className="pointer-events-none">
              <AgentCard agent={preview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page wrapper: TokenGate → allowlist check → form or coming soon ──

function CreateGated({ sessionToken }: { sessionToken: string | null }) {
  const { address } = useAccount();
  const isApproved = address && APPROVED_CREATORS.includes(address.toLowerCase());

  if (!isApproved) {
    return <ComingSoon sessionToken={sessionToken} />;
  }

  return <CreateForm sessionToken={sessionToken} />;
}

export default function CreateAgentPage() {
  const { sessionToken } = useSessionToken();

  return (
    <DashboardLayout>
      <TokenGate minBalance={GATE_THRESHOLDS.marketplace_create} featureName="Agent Creation">
        <CreateGated sessionToken={sessionToken} />
      </TokenGate>
    </DashboardLayout>
  );
}
