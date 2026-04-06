"use client";

import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";

export default function NFTPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        {/* Badge */}
        <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full mb-6 inline-block">
          Coming Soon
        </span>

        <h1 className="text-white font-heading text-4xl mb-4">CLAUDIA NFT Collection</h1>

        <p className="text-zinc-400 text-lg mb-2 max-w-md mx-auto">
          10,000 unique CLAUDIA NFTs on Base. Each one a key to the platform.
        </p>

        <p className="text-zinc-600 text-sm mb-12 max-w-sm mx-auto">
          Different moods. Different outfits. Different attitudes. Rare traits. Legendary pieces. All
          unbothered.
        </p>

        {/* Tier cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-12">
          {[
            { tier: "Common", supply: "6,000", color: "text-zinc-400", border: "border-zinc-700", desc: "Base CLAUDIA moods" },
            { tier: "Rare", supply: "2,500", color: "text-blue-400", border: "border-blue-500/30", desc: "Outfits + backgrounds" },
            { tier: "Epic", supply: "1,000", color: "text-purple-400", border: "border-purple-500/30", desc: "Special traits" },
            { tier: "Legendary", supply: "500", color: "text-yellow-400", border: "border-yellow-500/30", desc: "Unique 1-of-1 style" },
          ].map((t) => (
            <div key={t.tier} className={`bg-surface border ${t.border} rounded-2xl p-4`}>
              <p className={`font-heading text-lg ${t.color}`}>{t.tier}</p>
              <p className="text-white text-2xl font-heading">{t.supply}</p>
              <p className="text-zinc-600 text-xs mt-1">{t.desc}</p>
            </div>
          ))}
        </div>

        {/* Mint tiers */}
        <div className="max-w-md mx-auto bg-surface border border-white/5 rounded-2xl p-6 mb-8 text-left">
          <p className="text-zinc-400 text-xs uppercase tracking-wider mb-4">How to Mint</p>
          <div className="space-y-3">
            {[
              { type: "Free Mint", req: "Hold 1M+ $CLAUDIA", gets: "Random Common", limit: "1 per wallet", color: "text-green-400" },
              { type: "Paid Mint", req: "Burn 100K $CLAUDIA", gets: "Common or Rare", limit: "5 per wallet", color: "text-blue-400" },
              { type: "Earned", req: "Monthly leaderboard top 10", gets: "Epic or Legendary", limit: "Airdropped automatically", color: "text-purple-400" },
            ].map((m) => (
              <div key={m.type} className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium ${m.color}`}>{m.type}</p>
                  <p className="text-zinc-500 text-xs">{m.req}</p>
                  <p className="text-zinc-600 text-xs">{m.limit}</p>
                </div>
                <p className="text-zinc-300 text-sm text-right">{m.gets}</p>
              </div>
            ))}
          </div>
        </div>

        {/* NFT as avatar */}
        <div className="max-w-md mx-auto bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 mb-8">
          <p className="text-purple-400 text-sm font-medium mb-1">Your NFT = Your Platform Identity</p>
          <p className="text-zinc-400 text-sm">
            Mint a CLAUDIA NFT and set it as your avatar on the leaderboard. Rarer traits = more flex.
            Legendary holders get exclusive platform perks.
          </p>
        </div>

        {/* CTA */}
        <p className="text-zinc-600 text-sm mb-4">Get notified when mint goes live</p>
        <a
          href="https://t.me/askclaudia"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent hover:bg-[#27c00e] text-white font-heading font-bold px-8 py-3 rounded-2xl transition-all mb-3 inline-block"
        >
          Join Telegram &rarr;
        </a>
        <p className="text-zinc-700 text-xs">or follow @0xCLAUDIA_wtf on X</p>

        {/* Footer */}
        <div className="mt-16">
          <p className="text-zinc-700 text-xs">
            CA: 0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B &middot; Base Chain &middot; app.claudia.wtf
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
