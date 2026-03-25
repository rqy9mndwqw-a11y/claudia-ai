"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import WalletConnect from "@/components/WalletConnect";

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push("/chat");
    }
  }, [isConnected, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="fixed inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        <div className="w-24 h-24 rounded-full bg-surface border-2 border-accent/30 flex items-center justify-center mb-8 glow">
          <img
            src="/claudia-logo.svg"
            alt="Claudia"
            className="w-16 h-16 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <h1 className="font-heading text-5xl md:text-6xl font-extrabold text-white mb-3">
          Claudia <span className="text-accent">AI</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl mb-2 max-w-lg leading-relaxed">
          DeFi without the drama. Ask what to do with your money and get real
          answers — not disclaimers.
        </p>
        <p className="text-zinc-500 text-sm mb-10 italic tracking-wide">
          &ldquo;When Claude won&apos;t, Claudia will.&rdquo;
        </p>
        <WalletConnect />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 w-full">
          {[
            { title: "Live Yields", desc: "Real protocol data from DeFiLlama. No guessing, no stale numbers." },
            { title: "Plain English", desc: "Ask anything about DeFi. Claudia explains it like a smart friend." },
            { title: "Your Keys", desc: "Claudia never holds your funds. You sign every transaction yourself." },
          ].map((f) => (
            <div key={f.title} className="bg-surface rounded-xl p-5 border border-white/5 hover:border-white/10 hover:bg-surface-light/50 transition-all duration-200">
              <h3 className="font-heading font-bold text-white mb-1.5">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-xs mt-12">
          Requires 10,000 $CLAUDIA on Base to access. Not financial advice.
        </p>
      </div>
    </main>
  );
}
