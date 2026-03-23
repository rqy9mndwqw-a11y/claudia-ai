"use client";

import { useEffect, useState } from "react";

type AvatarState = "idle" | "thinking" | "responding" | "sideeye" | "smug";

interface ClaudiaAvatarProps {
  state: AvatarState;
}

const QUIPS: Record<AvatarState, string[]> = {
  idle: [
    "go ahead, ask me",
    "I'm waiting...",
    "you gonna type or what",
    "I don't have all day",
    "*files nails*",
    "...",
    "tick tock",
  ],
  thinking: [
    "ugh, fine...",
    "let me check...",
    "hold on",
    "looking into it",
    "*sighs*",
    "processing your chaos",
    "one sec, genius",
  ],
  responding: [
    "here's the deal",
    "you're welcome",
    "obviously",
    "told you I'm better",
    "Claude could never",
    "easy",
    "I have answers",
  ],
  sideeye: [
    "I see you looking",
    "browsing, huh?",
    "interesting choice...",
    "mm-hmm",
    "I have thoughts",
    "*raises eyebrow*",
    "you gonna ask or just stare",
  ],
  smug: [
    "nailed it",
    "you're welcome",
    "too easy",
    "Claude is shaking",
    "what else you got",
    "that's how it's done",
    "no need to thank me",
  ],
};

const AVATAR_STYLES: Record<AvatarState, { glow: string; border: string; filter: string; animation: string }> = {
  idle: {
    glow: "bg-accent/20 opacity-60",
    border: "border-accent/40",
    filter: "brightness(1) saturate(1)",
    animation: "animate-float",
  },
  thinking: {
    glow: "bg-coral/30 opacity-100",
    border: "border-coral/60",
    filter: "brightness(0.9) saturate(0.8)",
    animation: "animate-think",
  },
  responding: {
    glow: "bg-accent/40 opacity-100",
    border: "border-accent/60",
    filter: "brightness(1.1) saturate(1.2)",
    animation: "animate-sass",
  },
  sideeye: {
    glow: "bg-accent/25 opacity-80",
    border: "border-accent/50",
    filter: "brightness(1) saturate(1)",
    animation: "animate-sideeye",
  },
  smug: {
    glow: "bg-accent/50 opacity-100",
    border: "border-accent/70",
    filter: "brightness(1.15) saturate(1.3)",
    animation: "animate-smug",
  },
};

export default function ClaudiaAvatar({ state }: ClaudiaAvatarProps) {
  const [quip, setQuip] = useState("ask me something");
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const pool = QUIPS[state] || QUIPS.idle;
    setQuip(pool[Math.floor(Math.random() * pool.length)]);
  }, [state]);

  // Random head tilt
  useEffect(() => {
    const getTilt = () => {
      switch (state) {
        case "sideeye": return -5 + Math.random() * 2; // tilted left, looking sideways
        case "smug": return 3 + Math.random() * 3; // tilted right, chin up
        case "thinking": return -2 + Math.random() * 4;
        default: return Math.random() * 6 - 3;
      }
    };
    setTilt(getTilt());
    const interval = setInterval(() => setTilt(getTilt()), 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [state]);

  const styles = AVATAR_STYLES[state] || AVATAR_STYLES.idle;
  const dotColor = state === "thinking" ? "bg-coral animate-pulse"
    : state === "responding" || state === "smug" ? "bg-green-400"
    : state === "sideeye" ? "bg-yellow-400"
    : "bg-accent";

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className={`relative transition-transform duration-700 ease-in-out ${styles.animation}`}
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        {/* Glow */}
        <div className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${styles.glow}`} />

        {/* Avatar */}
        <div className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 ${styles.border} bg-surface transition-all duration-500`}>
          <img
            src="/claudia-avatar.png"
            alt="Claudia"
            className="w-full h-full object-cover object-top transition-all duration-500"
            style={{ filter: styles.filter }}
          />
          {state === "thinking" && (
            <div className="absolute inset-0 bg-coral/10 animate-pulse" />
          )}
          {state === "smug" && (
            <div className="absolute inset-0 bg-accent/5" />
          )}
        </div>

        {/* Status dot */}
        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-bg ${dotColor} transition-colors duration-300`} />
      </div>

      {/* Quip */}
      <p className={`text-xs italic max-w-[140px] text-center transition-all duration-300 ${
        state === "thinking" ? "text-coral"
        : state === "responding" || state === "smug" ? "text-accent"
        : state === "sideeye" ? "text-yellow-400/70"
        : "text-zinc-600"
      }`}>
        {quip}
      </p>
    </div>
  );
}
