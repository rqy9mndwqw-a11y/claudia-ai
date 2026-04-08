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
  const _session = useSessionToken(); // keep hook for potential future use

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

    </div>
  );
}
