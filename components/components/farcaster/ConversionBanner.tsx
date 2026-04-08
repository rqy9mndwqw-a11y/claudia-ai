"use client";

const AERODROME_SWAP_URL =
  "https://aerodrome.finance/swap?from=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&to=0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";

interface ConversionBannerProps {
  hasClaudia: boolean;
}

/**
 * Shown after roast generates inside Farcaster Mini App.
 * Drives $CLAUDIA purchase via Aerodrome swap link.
 */
export default function ConversionBanner({ hasClaudia }: ConversionBannerProps) {
  function handleOpenUrl(url: string) {
    import("@farcaster/miniapp-sdk")
      .then((mod) => { const sdk = mod.default ?? mod; sdk.actions.openUrl(url); })
      .catch(() => window.open(url, "_blank"));
  }

  if (hasClaudia) {
    return (
      <div className="bg-surface border border-accent/10 rounded-xl p-4 text-center">
        <p className="text-zinc-400 text-xs font-mono mb-2">
          Want the full AI analysis?
        </p>
        <button
          onClick={() => handleOpenUrl("https://app.claudia.wtf")}
          className="text-[11px] font-mono text-accent hover:text-accent/80 px-4 py-2
                     border border-accent/20 hover:border-accent/30 rounded-lg transition-colors cursor-pointer"
        >
          Launch CLAUDIA App →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-white/[0.06] rounded-xl p-4 text-center space-y-3">
      <p className="text-zinc-400 text-xs font-mono">
        Hold $CLAUDIA for full AI analysis + Maximum Toxicity roasts
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => handleOpenUrl(AERODROME_SWAP_URL)}
          className="text-[11px] font-mono text-accent hover:text-accent/80 px-4 py-2
                     border border-accent/20 hover:border-accent/30 rounded-lg transition-colors cursor-pointer
                     bg-accent/[0.06]"
        >
          Swap for $CLAUDIA →
        </button>
        <button
          onClick={() => handleOpenUrl("https://app.claudia.wtf")}
          className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 px-4 py-2
                     border border-white/[0.06] rounded-lg transition-colors cursor-pointer"
        >
          See what's unlocked
        </button>
      </div>
    </div>
  );
}
