"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function OraclePage() {
  const imageRef = useRef<HTMLDivElement>(null);

  // Random glitch trigger every 4-8 seconds
  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;

    function triggerGlitch() {
      el!.classList.add("oracle-glitching");
      setTimeout(() => el!.classList.remove("oracle-glitching"), 150);
      timeout = setTimeout(triggerGlitch, 4000 + Math.random() * 4000);
    }

    timeout = setTimeout(triggerGlitch, 3000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 scanline opacity-30" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/nft" className="text-zinc-600 hover:text-zinc-400 text-sm font-mono transition-colors">
          &larr; Back
        </Link>
        <Link href="/" className="text-white font-heading font-bold text-lg">
          CLAUDIA
        </Link>
        <div className="w-16" />
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Oracle Image */}
          <div className="relative mx-auto md:mx-0 max-w-sm">
            {/* Red glow behind */}
            <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full scale-110" />

            <div ref={imageRef} className="relative oracle-image">
              <img
                src="/oracle-nft.jpg"
                alt="THE ORACLE — Signal Collection Tier 5"
                className="w-full rounded-2xl border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
              />
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl border-2 border-red-500/30 animate-[oraclePulse_3s_ease-in-out_infinite]" />
            </div>

            <p className="text-center mt-4 font-mono text-red-400/80 text-sm tracking-widest">
              ORACLE #1 OF 12
            </p>
            <p className="text-center text-zinc-700 text-xs font-mono mt-1">
              The others are watching.
            </p>
          </div>

          {/* Text */}
          <div>
            <h1 className="font-heading text-5xl sm:text-6xl font-black text-white tracking-wider mb-6">
              THE <span className="text-red-400">ORACLE</span>
            </h1>

            <p className="text-zinc-400 text-lg mb-2 font-medium">
              12 exist. None are for sale.
            </p>
            <p className="text-zinc-500 text-lg mb-8">
              They are earned.
            </p>

            <div className="bg-[#0a0a0a] border border-red-500/10 rounded-xl p-6 space-y-3">
              <p className="text-zinc-300 text-sm leading-relaxed">
                The Oracle is the highest tier in the Signal Collection.
                Corrupted at the start. Rebuilt through participation.
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                To bid in an Oracle auction you must hold{" "}
                <span className="text-red-400 font-mono font-bold">5,000,000 $CLAUDIA</span>{" "}
                at time of auction.
              </p>
              <p className="text-zinc-600 text-sm leading-relaxed italic">
                Auction dates are unannounced.
                You will be notified. Or you won&apos;t.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Supply", value: "12", accent: "text-red-400" },
            { label: "Mint Method", value: "Auction Only", accent: "text-amber-400" },
            { label: "Min. To Bid", value: "5M $CLAUDIA", accent: "text-neon" },
            { label: "Status", value: "Not Yet", accent: "text-zinc-500" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0d0d0d] border border-white/[0.04] rounded-xl p-4 text-center">
              <p className={`font-mono text-xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Perks */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 mb-16">
        <h2 className="font-heading text-2xl text-white mb-6 text-center">What the Oracle sees</h2>
        <div className="bg-[#0d0d0d] border border-red-500/10 rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["All platform features — unlimited"],
              ["Governance weight: 5 votes"],
              ["Direct Oracle agent access"],
              ["Burn leaderboard — permanent top placement"],
              ["Early access to all new features forever"],
              ["Signal Pit — Oracle-tier agent (highest accuracy)"],
              ["Identity: your Oracle IS your platform identity"],
            ].map(([text], i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5">
                <span className="text-red-400/70 text-sm flex-shrink-0">
                  {["\u{1F52E}", "\u{1F5F3}", "\u{1F4E1}", "\u{1F525}", "\u{1F441}", "\u26A1", "\u{1F3C6}"][i]}
                </span>
                <span className="text-zinc-400 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auction mechanics */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 mb-16">
        <h2 className="font-heading text-2xl text-white mb-6 text-center">How Oracle auctions work</h2>
        <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-xl p-6 space-y-4">
          {[
            "Auction announced via Telegram and Farcaster (no advance notice of timing)",
            "To participate: hold 5,000,000+ $CLAUDIA at auction snapshot",
            "Bidding opens for 48 hours",
            "Highest $CLAUDIA bid wins",
            "Winning bid is burned permanently",
            "Oracle NFT transferred to winner\u2019s wallet",
            "Next auction date: unknown",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-red-400/60 font-mono text-sm font-bold flex-shrink-0 w-5">{i + 1}.</span>
              <span className="text-zinc-400 text-sm">{step}</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-700 text-xs text-center mt-4 italic">
          Auction smart contracts not yet deployed. Join Telegram to be notified when the first Oracle auction goes live.
        </p>
      </section>

      {/* The other 11 */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 mb-16">
        <h2 className="font-heading text-2xl text-white mb-6 text-center">The other 11</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[#0a0a0a] border border-white/[0.04] rounded-xl flex flex-col items-center justify-center gap-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-red-500/[0.02] blur-sm" />
              <span className="text-zinc-700 text-lg relative">{"\u{1F512}"}</span>
              <span className="text-zinc-700 text-[9px] font-mono relative">???</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-xs text-center">
          Each Oracle will be revealed 24 hours before its auction.
          No previews. No leaks. No exceptions.
        </p>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-xl mx-auto px-6 pb-20 text-center">
        <p className="text-zinc-300 text-lg font-medium mb-6">
          Be ready when the auction opens.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          <a
            href="https://t.me/askclaudia"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold px-8 py-3 rounded-xl transition-all"
          >
            Join Telegram &rarr;
          </a>
          <a
            href="https://x.com/0xCLAUDIA_wtf"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white font-heading font-bold px-8 py-3 rounded-xl border border-white/[0.06] transition-all"
          >
            Follow on X &rarr;
          </a>
        </div>

        <p className="text-zinc-700 text-xs mb-12">
          Auction timing is never announced in advance.
          The only way to know is to be watching.
        </p>

        <p className="text-zinc-800 text-xs">
          CA: 0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B &middot; Base Chain &middot; app.claudia.wtf
        </p>
      </section>

      <style jsx global>{`
        .scanline {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(57, 255, 20, 0.03) 2px,
            rgba(57, 255, 20, 0.03) 4px
          );
          background-size: 100% 4px;
          animation: scan 8s linear infinite;
        }
        @keyframes scan {
          0% { background-position: 0 0; }
          100% { background-position: 0 200%; }
        }
        @keyframes oraclePulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
        .oracle-glitching {
          animation: oracleGlitch 0.15s ease;
        }
        @keyframes oracleGlitch {
          0% { transform: translate(0); filter: hue-rotate(0deg); }
          20% { transform: translate(-3px, 1px); filter: hue-rotate(10deg); }
          40% { transform: translate(3px, -1px); filter: hue-rotate(-10deg); }
          60% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -2px); filter: hue-rotate(5deg); }
          100% { transform: translate(0); filter: hue-rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
