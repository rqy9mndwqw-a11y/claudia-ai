"use client";

import { useState } from "react";

type ShareButtonsProps = {
  roastText: string;
  walletShort: string;
  roastId: string;
  qualityScore: number;
  totalValue: number;
  pnlTotal: number;
  txCount: number;
};

export default function ShareButtons({
  roastText,
  walletShort,
  roastId,
  qualityScore,
  totalValue,
  pnlTotal,
  txCount,
}: ShareButtonsProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const truncated = roastText.length > 180
    ? roastText.slice(0, 180).replace(/\s+\S*$/, "") + "..."
    : roastText;

  const pinnedTweetUrl = `https://twitter.com/0xCLAUDIA_wtf/status/${process.env.NEXT_PUBLIC_TWITTER_PINNED_TWEET_ID || "2040638022253744644"}`;

  const shareText = `.@0xCLAUDIA_wtf just read my entire on-chain history and chose violence\n\n${truncated}\n\nyours: roast.claudia.wtf`;

  function shareToX() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pinnedTweetUrl)}`;
    window.open(url, "_blank");
  }

  function shareToFarcaster() {
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  async function submitForROTD() {
    if (submitted || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/roast/submit-for-rotd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roastId,
          walletAddress: walletShort,
          roastText,
          qualityScore,
          portfolioUsd: totalValue,
          pnlTotal,
          txCount,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={shareToX}
        className="text-[10px] font-mono text-zinc-400 hover:text-white px-3 py-1.5
                   border border-white/[0.06] hover:border-white/[0.15] rounded transition-colors cursor-pointer
                   flex items-center gap-1.5"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share to X
      </button>

      <button
        onClick={shareToFarcaster}
        className="text-[10px] font-mono text-zinc-400 hover:text-purple-400 px-3 py-1.5
                   border border-white/[0.06] hover:border-purple-500/30 rounded transition-colors cursor-pointer
                   flex items-center gap-1.5"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.182 3h13.636v1.636H22v2.182h-1.636v11.454h.818c.3 0 .545.245.545.546v1.09h-4.363v-1.09c0-.3.244-.546.545-.546h.818v-5.727L15.273 18H8.727L5.273 12.545v5.727h.818c.301 0 .545.245.545.546v1.09H2.273v-1.09c0-.3.244-.546.545-.546h.818V6.818H2V4.636h3.182V3z" />
        </svg>
        Share to Farcaster
      </button>

      <button
        onClick={submitForROTD}
        disabled={submitted || submitting}
        className={`text-[10px] font-mono px-3 py-1.5 rounded transition-colors cursor-pointer
                   flex items-center gap-1.5 border
                   ${submitted
                     ? "text-green-400 border-green-500/20 bg-green-500/[0.06] cursor-default"
                     : "text-amber-400 hover:text-amber-300 border-amber-500/20 hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
                   }`}
      >
        {submitted ? "Submitted" : submitting ? "Submitting..." : "Submit for Roast of the Day"}
      </button>

      {submitted && (
        <span className="text-[9px] text-zinc-600 font-mono self-center ml-1">
          Winners posted daily at 9AM UTC
        </span>
      )}
    </div>
  );
}
