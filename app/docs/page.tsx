"use client";

import { useState } from "react";

const SECTIONS = [
  "Agents",
  "Credits",
  "MCP Server",
  "API",
  "Signal Pit",
  "NFT Collection",
  "Security",
];

export default function DocsComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-zinc-200 flex flex-col items-center justify-center px-4">
      {/* Subtle background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(232,41,91,0.04)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-md text-center">
        <div className="text-[10px] font-mono text-accent/60 tracking-[6px] uppercase mb-6">
          CLAUDIA DOCS
        </div>

        <h1 className="font-heading text-4xl font-bold text-white mb-4">
          Coming soon.
        </h1>

        <p className="text-zinc-500 text-sm leading-relaxed mb-8">
          Everything you need to build with, use, and understand CLAUDIA.
        </p>

        {/* Section list */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {SECTIONS.map((s) => (
            <span
              key={s}
              className="text-[11px] font-mono text-zinc-600 bg-surface border border-white/[0.06] px-3 py-1.5 rounded"
            >
              {s}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex justify-center gap-3 mb-6">
          {!submitted ? (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-sm
                           font-mono text-white placeholder:text-zinc-700 outline-none
                           focus:border-accent/30 transition-colors w-56"
              />
              <button
                onClick={() => {
                  if (email.includes("@")) setSubmitted(true);
                }}
                className="bg-accent hover:bg-accent/80 text-white font-heading font-bold
                           px-5 py-2.5 rounded-lg transition-all text-sm"
              >
                Notify Me
              </button>
            </div>
          ) : (
            <div className="text-green-400 text-sm font-mono">
              noted. you&apos;ll be first to know.
            </div>
          )}
        </div>

        <a
          href="https://app.claudia.wtf"
          className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors"
        >
          Back to App
        </a>

        {/* Footer */}
        <div className="mt-16 text-zinc-700 text-[10px] font-mono tracking-wider">
          docs.claudia.wtf
        </div>
      </div>
    </div>
  );
}
