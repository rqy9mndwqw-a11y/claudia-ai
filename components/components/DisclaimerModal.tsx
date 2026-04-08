"use client";

import { useState } from "react";

interface DisclaimerModalProps {
  sessionToken: string;
  onAccepted: () => void;
}

export default function DisclaimerModal({ sessionToken, onAccepted }: DisclaimerModalProps) {
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canContinue = check1 && check2 && !submitting;

  async function handleAccept() {
    if (!canContinue) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/accept-terms", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) onAccepted();
    } catch {} finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-2xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-8">
          {/* Section 1 */}
          <div className="mb-8">
            <h2 className="font-heading text-xl font-bold text-white mb-1">
              User Agreement &amp; Risk Disclaimer
            </h2>
            <p className="text-zinc-500 text-sm mb-4">By continuing, you acknowledge and agree to the following:</p>
            <ul className="space-y-3 text-zinc-400 text-sm leading-relaxed">
              {[
                "You understand that cryptocurrency investments carry a high level of risk, including the possible loss of all funds.",
                "CLAUDIA utilizes AI and algorithmic tools to suggest or execute trades. You retain full control of your wallet, private key, and funds at all times, including the ability to disable automated trading at any time.",
                "We do not guarantee profits, returns, or performance of any kind. Any trading decisions, whether made by you or through AI automation, are at your own discretion and risk.",
                "We are not responsible for any financial losses, damages, or liabilities arising from your use of the platform, including but not limited to: market volatility, technical errors, third-party service failures, or AI misjudgments.",
                "This platform does not offer financial, investment, tax, or legal advice. Please consult your own advisors before making any investment decisions.",
                "You agree to hold harmless and indemnify CLAUDIA, its team, affiliates, and partners from any claims, demands, or losses resulting from your use of the platform.",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-0.5">&bull;</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 mt-4 cursor-pointer group">
              <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-transparent accent-accent cursor-pointer" />
              <span className="text-zinc-300 text-sm group-hover:text-white transition-colors">
                I acknowledge and agree to the User Agreement &amp; Risk Disclaimer.
              </span>
            </label>
          </div>

          {/* Section 2 */}
          <div className="mb-8">
            <h2 className="font-heading text-xl font-bold text-white mb-1">
              Restricted Jurisdictions Declaration
            </h2>
            <p className="text-zinc-500 text-sm mb-4">By using this platform, you affirm that:</p>
            <ul className="space-y-3 text-zinc-400 text-sm leading-relaxed">
              {[
                "You are not a citizen, resident, or located in any jurisdiction where participation in crypto trading or use of this platform would violate local laws or regulations.",
                "Specifically, you are not accessing this platform from the United States, North Korea, Iran, Syria, Cuba, or any other country or territory subject to sanctions or restrictions by the United Nations, European Union, OFAC, or other relevant regulatory bodies.",
                "You are solely responsible for understanding and complying with your local laws and regulations before using this platform.",
                "If at any point you become subject to such restrictions, you agree to immediately cease use of the platform.",
              ].map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent flex-shrink-0 mt-0.5">&bull;</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 mt-4 cursor-pointer group">
              <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-transparent accent-accent cursor-pointer" />
              <span className="text-zinc-300 text-sm group-hover:text-white transition-colors">
                I affirm the Restricted Jurisdictions Declaration.
              </span>
            </label>
          </div>

          <button onClick={handleAccept} disabled={!canContinue}
            className={`w-full py-3 rounded-xl font-heading font-bold text-sm transition-all ${
              canContinue
                ? "bg-accent hover:bg-[#27c00e] text-white shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}>
            {submitting ? "Processing..." : "CONTINUE"}
          </button>
        </div>
      </div>
    </div>
  );
}
