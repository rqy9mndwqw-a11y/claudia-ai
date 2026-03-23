"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export type ClaudiaMood = "idle" | "impatient" | "thinking" | "excited" | "skeptical" | "talking";

interface ClaudiaProps {
  imageSrc: string;
  mood: ClaudiaMood;
  message?: string;
  className?: string;
}

const IDLE_MESSAGES = [
  "tapping nails waiting for you...",
  "the pools aren't going to analyze themselves",
  "still here. unfortunately.",
  "you going to connect that wallet or what",
  "i've seen better yields. not lately though.",
];

export default function ClaudiaCharacter({ imageSrc, mood, message, className = "" }: ClaudiaProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [isFading, setIsFading] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const messageQueueRef = useRef<string[]>([]);
  const isDisplayingRef = useRef(false);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Display words one at a time
  const displayMessage = useCallback((msg: string) => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (wordIntervalRef.current) {
      clearInterval(wordIntervalRef.current);
      wordIntervalRef.current = null;
    }

    isDisplayingRef.current = true;
    setIsFading(false);
    setCurrentMessage(msg);

    const words = msg.split(/\s+/).filter(Boolean);
    let index = 0;
    setDisplayedWords([]);

    wordIntervalRef.current = setInterval(() => {
      if (index < words.length) {
        setDisplayedWords((prev) => [...prev, words[index]]);
        index++;
      } else {
        if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
        wordIntervalRef.current = null;
        isDisplayingRef.current = false;

        // Fade out after 4 seconds
        fadeTimeoutRef.current = setTimeout(() => {
          setIsFading(true);
          // After fade animation, clear and check queue
          setTimeout(() => {
            setDisplayedWords([]);
            setIsFading(false);
            setCurrentMessage("");
            // Process next queued message
            if (messageQueueRef.current.length > 0) {
              const next = messageQueueRef.current.shift()!;
              displayMessage(next);
            }
          }, 500);
        }, 4000);
      }
    }, 80);
  }, []);

  // Handle incoming messages
  useEffect(() => {
    if (!message) return;
    if (message === currentMessage) return;

    if (isDisplayingRef.current) {
      // Queue it — will display after current finishes its current word
      messageQueueRef.current = [message]; // Replace queue, only latest matters
    } else {
      displayMessage(message);
    }
  }, [message, currentMessage, displayMessage]);

  // Idle message rotation
  useEffect(() => {
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
      idleIntervalRef.current = null;
    }

    if (mood === "idle" && !message && !isDisplayingRef.current) {
      // Start rotation after initial delay
      const startDelay = setTimeout(() => {
        if (!isDisplayingRef.current) {
          const randomIdle = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
          displayMessage(randomIdle);
        }

        idleIntervalRef.current = setInterval(() => {
          if (!isDisplayingRef.current && messageQueueRef.current.length === 0) {
            const randomIdle = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)];
            displayMessage(randomIdle);
          }
        }, 8000 + Math.random() * 4000);
      }, 2000);

      return () => {
        clearTimeout(startDelay);
        if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      };
    }
  }, [mood, message, displayMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    };
  }, []);

  const moodClass = `claudia-mood-${mood}`;
  const glowClass = mood === "excited" ? "claudia-glow-excited"
    : mood === "talking" ? "claudia-glow-talking"
    : "";

  const borderColor = mood === "thinking" ? "border-coral/60"
    : mood === "excited" ? "border-accent/80"
    : mood === "impatient" ? "border-yellow-400/50"
    : mood === "skeptical" ? "border-yellow-400/40"
    : mood === "talking" ? "border-accent/60"
    : "border-accent/40";

  const dotColor = mood === "thinking" ? "bg-coral animate-pulse"
    : mood === "excited" ? "bg-green-400 animate-pulse"
    : mood === "impatient" ? "bg-yellow-400"
    : mood === "skeptical" ? "bg-yellow-400/70"
    : mood === "talking" ? "bg-accent animate-pulse"
    : "bg-accent";

  return (
    <div className={`flex flex-col items-center gap-3 py-4 ${className}`}>
      {/* Character image wrapper */}
      <div className={`claudia-character relative ${moodClass} ${glowClass}`}>
        {/* Glow background */}
        <div
          className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-500 ${
            mood === "excited" ? "bg-accent/40 opacity-100"
            : mood === "talking" ? "bg-accent/30 opacity-100"
            : mood === "thinking" ? "bg-coral/30 opacity-80"
            : mood === "impatient" ? "bg-yellow-400/20 opacity-60"
            : mood === "skeptical" ? "bg-yellow-400/15 opacity-50"
            : "bg-accent/20 opacity-40"
          }`}
        />

        {/* Avatar */}
        <div className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 ${borderColor} bg-surface transition-all duration-500`}>
          <img
            src={imageSrc}
            alt="Claudia"
            className="w-full h-full object-cover object-top transition-all duration-300"
            style={{
              filter: mood === "thinking" ? "brightness(0.9) saturate(0.8)"
                : mood === "excited" ? "brightness(1.15) saturate(1.3)"
                : mood === "talking" ? "brightness(1.1) saturate(1.2)"
                : "brightness(1) saturate(1)",
            }}
          />
          {mood === "thinking" && (
            <div className="absolute inset-0 bg-coral/10 animate-pulse" />
          )}
        </div>

        {/* Status dot */}
        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-bg ${dotColor} transition-colors duration-300`} />
      </div>

      {/* Text bubble */}
      <div className="relative w-44 min-h-[2.5rem]">
        <div
          className={`text-xs italic text-center leading-relaxed px-2 py-1.5 rounded-lg bg-surface/50 border border-white/5 ${
            isFading ? "claudia-text-fading" : ""
          } ${
            mood === "thinking" ? "text-coral"
            : mood === "excited" ? "text-accent"
            : mood === "impatient" ? "text-yellow-400/80"
            : mood === "skeptical" ? "text-yellow-400/60"
            : mood === "talking" ? "text-accent/90"
            : "text-zinc-500"
          }`}
        >
          {displayedWords.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className="claudia-word"
              style={{ animationDelay: `${i * 0.02}s` }}
            >
              {word}{" "}
            </span>
          ))}
          {displayedWords.length === 0 && (
            <span className="text-zinc-700">&nbsp;</span>
          )}
        </div>
      </div>
    </div>
  );
}
