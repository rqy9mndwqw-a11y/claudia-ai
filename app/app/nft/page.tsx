"use client";

import DashboardLayout from "@/components/ui/DashboardLayout";

const TIERS = [
  {
    tier: "Common",
    supply: 500,
    method: "Burn to Mint",
    burn: "10,000 $CLAUDIA",
    requirement: null,
    perks: "Platform identity, leaderboard avatar",
    color: "text-zinc-400",
    border: "border-zinc-600/40",
    bg: "bg-zinc-500/5",
    glow: "",
  },
  {
    tier: "Rare",
    supply: 300,
    method: "Burn to Mint",
    burn: "50,000 $CLAUDIA",
    requirement: null,
    perks: "Rug Detector warning overlay, priority signals",
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    glow: "",
  },
  {
    tier: "Epic",
    supply: 150,
    method: "Burn to Mint",
    burn: "250,000 $CLAUDIA",
    requirement: null,
    perks: "Chart Reader TA overlays, Signal Pit access, governance (1 vote)",
    color: "text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    glow: "",
  },
  {
    tier: "Legendary",
    supply: 50,
    method: "Auction Only",
    burn: null,
    requirement: "Hold 2,500,000 $CLAUDIA to bid",
    perks: "All Epic perks + governance (3 votes), exclusive Legendary-only signals",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
  },
  {
    tier: "Oracle",
    supply: 12,
    method: "Auction Only",
    burn: null,
    requirement: "Hold 5,000,000 $CLAUDIA to bid",
    perks: "All Legendary perks + governance (5 votes), direct Oracle agent access",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.15)]",
  },
];

export default function NFTPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Badge */}
        <div className="text-center mb-10">
          <span className="text-xs bg-accent/10 text-accent border border-accent/30 px-3 py-1 rounded-full mb-6 inline-block">
            Coming Soon
          </span>

          <h1 className="text-white font-heading text-4xl mb-3">
            CLAUDIA Signal Collection
          </h1>
          <p className="text-zinc-400 text-lg mb-2 max-w-lg mx-auto">
            1,012 NFTs on Base. Each one a signal.
          </p>
          <p className="text-zinc-600 text-sm max-w-md mx-auto">
            Five tiers. Burn $CLAUDIA to mint. The rarer your NFT, the deeper your access.
            Legendary and Oracle are auction only — earned, never bought.
          </p>
        </div>

        {/* Tier cards */}
        <div className="space-y-3 mb-12">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className={`${t.bg} border ${t.border} rounded-xl p-5 ${t.glow} transition-all
                ${t.tier === "Oracle" ? "relative overflow-hidden" : ""}`}
            >
              {/* Oracle glitch effect */}
              {t.tier === "Oracle" && (
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.3) 2px, rgba(239,68,68,0.3) 4px)",
                    animation: "glitch 3s infinite steps(5)",
                  }}
                />
              )}

              <div className="flex items-start justify-between gap-4 relative">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`font-heading text-lg font-bold ${t.color}`}>
                      {t.tier}
                    </span>
                    <span className="text-zinc-600 text-xs font-mono">
                      {t.supply} supply
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      t.method === "Auction Only"
                        ? "border-amber-500/30 text-amber-400/80 bg-amber-500/10"
                        : "border-accent/20 text-accent/80 bg-accent/5"
                    }`}>
                      {t.method}
                    </span>
                    {t.burn && (
                      <span className="text-zinc-500 text-xs font-mono">
                        Burn {t.burn}
                      </span>
                    )}
                    {t.requirement && (
                      <span className="text-zinc-500 text-xs font-mono">
                        {t.requirement}
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-500 text-xs leading-relaxed">
                    {t.perks}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How to Mint */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-surface border border-white/5 rounded-xl p-5">
            <p className="text-accent text-xs uppercase tracking-wider font-bold mb-2">
              Burn to Mint
            </p>
            <p className="text-zinc-400 text-sm mb-1">Common, Rare, Epic</p>
            <p className="text-zinc-600 text-xs leading-relaxed">
              Burn $CLAUDIA permanently to receive your NFT. More burn = rarer tier. Burns are forever.
            </p>
          </div>

          <div className="bg-surface border border-amber-500/10 rounded-xl p-5">
            <p className="text-amber-400 text-xs uppercase tracking-wider font-bold mb-2">
              Auction Only
            </p>
            <p className="text-zinc-400 text-sm mb-1">Legendary (50) &amp; Oracle (12)</p>
            <p className="text-zinc-600 text-xs leading-relaxed">
              Must hold minimum $CLAUDIA to participate. Dates announced via Telegram. Never airdropped. Never direct mint.
            </p>
          </div>

          <div className="bg-surface border border-purple-500/10 rounded-xl p-5">
            <p className="text-purple-400 text-xs uppercase tracking-wider font-bold mb-2">
              Monthly Earned
            </p>
            <p className="text-zinc-400 text-sm mb-1">Top 10 leaderboard</p>
            <p className="text-zinc-600 text-xs leading-relaxed">
              Epic NFT airdropped automatically at month end. Only Epic tier — never Legendary or Oracle.
            </p>
          </div>
        </div>

        {/* Oracle auction teaser */}
        <a
          href="/oracle"
          className="block bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-12 text-center hover:border-red-500/40 transition-colors group"
        >
          <p className="text-red-400 font-heading text-lg font-bold mb-1">
            THE ORACLE — 12 Exist
          </p>
          <p className="text-zinc-500 text-sm">
            Auction only. 5M $CLAUDIA to bid. None are for sale.
          </p>
          <p className="text-red-400/60 text-xs mt-2 group-hover:text-red-400 transition-colors">
            View Oracle Auction &rarr;
          </p>
        </a>

        {/* CTA */}
        <div className="text-center">
          <p className="text-zinc-400 text-sm mb-4">
            Mint opens soon. Burn $CLAUDIA. Earn your signal.
          </p>
          <a
            href="https://t.me/askclaudia"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold px-8 py-3 rounded-2xl transition-all mb-3 inline-block"
          >
            Join Telegram &rarr;
          </a>
          <p className="text-zinc-700 text-xs mb-12">or follow @0xCLAUDIA_wtf on X</p>

          {/* Footer */}
          <p className="text-zinc-700 text-xs">
            CA: 0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B &middot; Base Chain &middot; app.claudia.wtf
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes glitch {
          0% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </DashboardLayout>
  );
}
