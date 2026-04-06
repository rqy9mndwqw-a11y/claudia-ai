"use client";

import { useState, useEffect } from "react";
import Sidebar, { SIDEBAR_COLLAPSED_PX, SIDEBAR_EXPANDED_PX } from "./Sidebar";
import AppHeader from "./AppHeader";
import FloatingWidget from "../chat/FloatingWidget";
import { useSessionToken } from "@/hooks/useSessionToken";

/**
 * Dashboard shell: sidebar (left) + header (top) + content.
 *
 * The expanded/collapsed state lives here so the content margin
 * stays in sync with the sidebar width. Both animate together.
 *
 * Mobile: sidebar is a hidden drawer, content is full-width.
 * Desktop (md+): content pushes right to match sidebar width.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const { promoCredits, dismissPromo } = useSessionToken();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const marginLeft = isDesktop
    ? expanded ? SIDEBAR_EXPANDED_PX : SIDEBAR_COLLAPSED_PX
    : 0;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar expanded={expanded} onToggle={() => setExpanded((e) => !e)} />

      <div
        className="flex flex-col min-h-screen transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft }}
      >
        <AppHeader />
        <main className="flex-1">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      <FloatingWidget />

      {/* Promo credit celebration */}
      {promoCredits > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={dismissPromo}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]" />

          {/* Confetti particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  backgroundColor: ["#f59e0b", "#8b5cf6", "#39ff14", "#10b981", "#3b82f6", "#ef4444"][i % 6],
                  animation: `confettiFall ${2 + Math.random() * 2}s ${Math.random() * 0.5}s ease-in forwards`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                  width: `${4 + Math.random() * 8}px`,
                  height: `${4 + Math.random() * 8}px`,
                  borderRadius: i % 3 === 0 ? "0" : "50%",
                }}
              />
            ))}
          </div>

          {/* Card */}
          <div
            className="relative bg-gradient-to-br from-accent/90 via-purple-600/90 to-pink-500/90 backdrop-blur-xl text-white rounded-3xl shadow-2xl p-8 max-w-sm mx-4 text-center animate-[bounceIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4 animate-[pulse_1s_ease-in-out_infinite]">🎁</div>
            <h2 className="font-heading text-3xl font-black mb-2">
              {promoCredits} FREE CREDITS
            </h2>
            <p className="text-white/80 text-sm mb-1">
              Welcome to CLAUDIA
            </p>
            <p className="text-white/60 text-xs mb-6">
              Boost promo — chat with any AI agent for free
            </p>
            <button
              onClick={dismissPromo}
              className="w-full bg-white text-accent font-heading font-bold py-3 px-6 rounded-xl hover:bg-white/90 transition-all text-sm"
            >
              LET&apos;S GO
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
