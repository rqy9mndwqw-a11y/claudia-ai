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
    <div className="md:hidden fixed bottom-20 right-4 z-50">
      {/* The actual character, revealed when open */}
      <div 
        className={`transition-all duration-500 transform origin-bottom-right ${
          isOpen 
            ? "scale-100 opacity-100 translate-y-0" 
            : "scale-0 opacity-0 translate-y-10 pointer-events-none"
        }`}
      >
        <div className="bg-surface/90 backdrop-blur-md rounded-2xl border border-accent/20 p-2 shadow-2xl shadow-accent/20 mb-2">
          <ClaudiaCharacter 
            imageSrc="/claudia-avatar.png"
            mood={claudiaMood}
            className="scale-90 py-0"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-surface-light flex items-center justify-center text-zinc-500"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full border-2 transition-all duration-300 shadow-lg overflow-hidden group ${
          isOpen 
            ? "border-accent bg-surface scale-90" 
            : "border-accent/40 bg-surface-light hover:border-accent"
        }`}
      >
        <img 
          src="/claudia-avatar.png" 
          alt="Claudia" 
          className={`w-full h-full object-cover object-top transition-all duration-500 ${
            isOpen ? "scale-110 brightness-110" : "scale-100 grayscale-[0.3]"
          }`}
        />
        
        {/* Notification ping */}
        {hasNewMessage && !isOpen && (
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-accent border-2 border-surface"></span>
          </span>
        )}

        {/* Pulsing ring when talking/excited */}
        {(claudiaMood === "excited" || claudiaMood === "talking") && !isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-40"></span>
        )}
      </button>
    </div>
  );
}
