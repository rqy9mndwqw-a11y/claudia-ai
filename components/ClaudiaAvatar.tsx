"use client";

import { useEffect, useState } from "react";

interface ClaudiaAvatarProps {
  state: "idle" | "thinking" | "responding";
}

const IDLE_QUIPS = [
  "go ahead, ask me",
  "I'm waiting...",
  "you gonna type or what",
  "I don't have all day",
  "ask me something",
  "*files nails*",
  "...",
];

const THINKING_QUIPS = [
  "ugh, fine...",
  "let me check...",
  "hold on",
  "looking into it",
  "one sec",
  "*sighs*",
];

const RESPONDING_QUIPS = [
  "here's the deal",
  "you're welcome",
  "obviously",
  "told you I'm better",
  "Claude could never",
  "easy",
  "no need to thank me",
  "I have answers",
];

export default function ClaudiaAvatar({ state }: ClaudiaAvatarProps) {
  const [quip, setQuip] = useState("ask me something");
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const quips =
      state === "thinking"
        ? THINKING_QUIPS
        : state === "responding"
        ? RESPONDING_QUIPS
        : IDLE_QUIPS;
    setQuip(quips[Math.floor(Math.random() * quips.length)]);
  }, [state]);

  // Subtle random head tilt
  useEffect(() => {
    const interval = setInterval(() => {
      setTilt(Math.random() * 6 - 3); // -3 to 3 degrees
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Avatar container with animations */}
      <div
        className={`relative transition-transform duration-700 ease-in-out ${
          state === "thinking" ? "animate-think" : state === "responding" ? "animate-sass" : "animate-float"
        }`}
        style={{ transform: `rotate(${tilt}deg)` }}
      >
        {/* Glow ring */}
        <div
          className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${
            state === "thinking"
              ? "bg-coral/30 opacity-100"
              : state === "responding"
              ? "bg-accent/40 opacity-100"
              : "bg-accent/20 opacity-60"
          }`}
        />

        {/* Avatar image */}
        <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-accent/40 bg-surface">
          <img
            src="/claudia-avatar.png"
            alt="Claudia"
            className="w-full h-full object-cover object-top"
          />

          {/* Overlay effects */}
          {state === "thinking" && (
            <div className="absolute inset-0 bg-coral/10 animate-pulse" />
          )}
        </div>

        {/* Status indicator dot */}
        <div
          className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-bg ${
            state === "thinking"
              ? "bg-coral animate-pulse"
              : state === "responding"
              ? "bg-green-400"
              : "bg-accent"
          }`}
        />
      </div>

      {/* Quip text */}
      <p
        className={`text-xs italic max-w-[140px] text-center transition-all duration-300 ${
          state === "thinking"
            ? "text-coral"
            : state === "responding"
            ? "text-accent"
            : "text-zinc-600"
        }`}
      >
        {quip}
      </p>
    </div>
  );
}
