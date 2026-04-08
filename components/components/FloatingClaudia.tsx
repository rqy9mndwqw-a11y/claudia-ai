"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import ClaudiaCharacter, { type ClaudiaMood } from "./ClaudiaCharacter";
import { useClaudiaMood } from "@/hooks/useClaudiaMood";
import { useAccount } from "wagmi";

export default function FloatingClaudia() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Only show on mobile (hidden on md+)
  // Also hide on landing page if not connected
  const shouldShow = pathname !== "/" || isConnected;

  const claudiaMood = useClaudiaMood({
    walletConnected: isConnected,
    loadingData: false,
    pools: [],
    aiResponding: false,
  });

  // Effect to "alert" user when mood changes or she has something to say
  useEffect(() => {
    if (!isOpen) {
      setHasNewMessage(true);
      const timer = setTimeout(() => setHasNewMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [claudiaMood, isOpen]);

  if (!shouldShow) return null;

  return (
    <div className="md:hidden">
      {/* Floating Avatar Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Show Claudia"
        className={`fixed bottom-4 right-4 z-[50] w-11 h-11 rounded-full border-2 transition-all duration-300 shadow-lg overflow-hidden ${
          isOpen
            ? "opacity-0 pointer-events-none scale-90"
            : "opacity-100 border-accent/40 bg-surface-light hover:border-accent"
        }`}
      >
        <img
          src="/avatar.png"
          alt="Claudia"
          className="w-full h-full object-cover object-top scale-100 grayscale-[0.3]"
        />

        {/* Notification ping */}
        {hasNewMessage && !isOpen && (
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-accent border-2 border-surface"></span>
          </span>
        )}

        {/* Pulsing glow ring when talking/excited */}
        {(claudiaMood === "excited" || claudiaMood === "talking") && !isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-40"></span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[70] max-h-[40vh] rounded-t-2xl bg-surface/95 backdrop-blur-md border-t border-white/10 shadow-2xl animate-slide-up">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-zinc-600 rounded-full" />
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close Claudia"
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-surface-light flex items-center justify-center text-zinc-400 hover:text-zinc-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Content */}
          <div className="overflow-y-auto px-4 pb-6">
            <ClaudiaCharacter
              imageSrc="/avatar.png"
              mood={claudiaMood}
              className="scale-90 py-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
