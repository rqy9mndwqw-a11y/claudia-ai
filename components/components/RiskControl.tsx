"use client";

import { useState, useEffect } from "react";

const PRESETS = {
  conservative: {
    label: "Conservative",
    stopLoss: 3.0,
    maxPositions: 2,
    quote: "I'll keep you safe. Probably.",
    emoji: "\u{1F6E1}\uFE0F",
    needle: -60,
    color: "#39ff14",
  },
  moderate: {
    label: "Moderate",
    stopLoss: 5.0,
    maxPositions: 3,
    quote: "Balanced. Unlike your portfolio.",
    emoji: "\u2696\uFE0F",
    needle: 0,
    color: "#ffd700",
  },
  aggressive: {
    label: "Aggressive",
    stopLoss: 8.0,
    maxPositions: 6,
    quote: "Your money, your funeral. Let's go.",
    emoji: "\u{1F525}",
    needle: 60,
    color: "#ef4444",
  },
} as const;

type RiskLevel = keyof typeof PRESETS;

interface RiskControlProps {
  sessionToken: string;
}

export default function RiskControl({ sessionToken }: RiskControlProps) {
  const [level, setLevel] = useState<RiskLevel>("moderate");
  const [stopLoss, setStopLoss] = useState(5.0);
  const [maxPos, setMaxPos] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/users/risk-settings", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d) {
          setLevel(d.risk_level || "moderate");
          setStopLoss(d.stop_loss_pct ?? 5.0);
          setMaxPos(d.max_positions ?? 3);
        }
      })
      .catch(() => {});
  }, [sessionToken]);

  function selectPreset(l: RiskLevel) {
    setLevel(l);
    setStopLoss(PRESETS[l].stopLoss);
    setMaxPos(PRESETS[l].maxPositions);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/risk-settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ risk_level: level, stop_loss_pct: stopLoss, max_positions: maxPos }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {} finally { setSaving(false); }
  }

  const preset = PRESETS[level];
  const sliderColor = stopLoss <= 5 ? "#39ff14" : stopLoss <= 10 ? "#ffd700" : "#ef4444";

  return (
    <div className="bg-surface border border-white/[0.06] rounded-xl p-6">
      <h3 className="font-heading text-lg font-bold text-white mb-6">Risk Control</h3>

      {/* Gauge */}
      <div className="flex justify-center mb-6">
        <div className="relative w-[200px] h-[110px]">
          <div className="w-[200px] h-[100px] rounded-t-full overflow-hidden"
            style={{ background: "conic-gradient(from 180deg, #39ff14 0deg 60deg, #ffd700 60deg 120deg, #ef4444 120deg 180deg, transparent 180deg)" }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140px] h-[70px] bg-surface rounded-t-full" />
          <div className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-50%) rotate(${preset.needle}deg)` }}>
            <div className="w-0.5 h-16 bg-white rounded-full mx-auto" />
            <div className="w-3 h-3 bg-white rounded-full -mt-1 mx-auto" />
          </div>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.entries(PRESETS) as [RiskLevel, (typeof PRESETS)[RiskLevel]][]).map(([key, p]) => (
          <button key={key} onClick={() => selectPreset(key)}
            className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              level === key ? "text-white border-2" : "text-zinc-500 border border-white/[0.06] hover:border-white/[0.1]"
            }`}
            style={level === key ? { borderColor: p.color, backgroundColor: `${p.color}15` } : {}}>
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-center text-zinc-500 text-sm mb-6 italic">
        {preset.emoji} &ldquo;{preset.quote}&rdquo;
      </p>

      {/* Stop Loss Slider */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-zinc-500">Stop Loss</span>
          <span className="text-white font-mono" style={{ color: sliderColor }}>{stopLoss.toFixed(1)}%</span>
        </div>
        <input type="range" min={1} max={15} step={0.5} value={stopLoss}
          onChange={(e) => { setStopLoss(parseFloat(e.target.value)); setSaved(false); }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${sliderColor} 0%, ${sliderColor} ${((stopLoss - 1) / 14) * 100}%, #27272a ${((stopLoss - 1) / 14) * 100}%, #27272a 100%)` }} />
        <p className="text-zinc-600 text-[10px] mt-1">Positions auto-close at -{stopLoss.toFixed(1)}% from entry</p>
      </div>

      {/* Max Positions */}
      <div className="mb-6">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-zinc-500">Max Positions</span>
          <div className="flex items-center gap-2">
            <button onClick={() => { setMaxPos(Math.max(1, maxPos - 1)); setSaved(false); }}
              className="w-6 h-6 rounded bg-white/[0.05] text-zinc-400 hover:text-white text-sm flex items-center justify-center cursor-pointer">-</button>
            <span className="text-white font-mono w-4 text-center">{maxPos}</span>
            <button onClick={() => { setMaxPos(Math.min(10, maxPos + 1)); setSaved(false); }}
              className="w-6 h-6 rounded bg-white/[0.05] text-zinc-400 hover:text-white text-sm flex items-center justify-center cursor-pointer">+</button>
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className={`w-full py-2.5 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer ${
          saved ? "bg-accent/20 text-accent border border-accent/30" : "bg-accent hover:bg-[#27c00e] text-white"
        }`}>
        {saving ? "Saving..." : saved ? "\u2713 Saved" : "Save Risk Settings"}
      </button>
    </div>
  );
}
