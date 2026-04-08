"use client";

import { useEffect, useState, useRef } from "react";

type KillfeedEvent = {
  id: string;
  type: string;
  message: string;
  color: string;
  created_at: number;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Killfeed() {
  const [events, setEvents] = useState<KillfeedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lastTimeRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    fetch("/api/arena/killfeed?limit=50")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d?.events?.length) {
          setEvents(d.events);
          lastTimeRef.current = d.events[0].created_at;
        }
      })
      .catch(() => {});
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/arena/killfeed?since=${lastTimeRef.current}&limit=20`);
        if (!res.ok) return;
        const d = (await res.json()) as any;
        if (d?.events?.length) {
          setEvents((prev) => [...d.events, ...prev].slice(0, 100));
          lastTimeRef.current = d.events[0].created_at;
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, []);

  // Auto-scroll to top on new events (unless paused)
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  const unreadCount = collapsed ? events.filter((e) => e.created_at > lastTimeRef.current - 30000).length : 0;

  return (
    <div className="bg-[#080808] border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-green-400 tracking-widest">▶ LIVE FEED</span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        {collapsed && unreadCount > 0 && (
          <span className="text-[9px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            {unreadCount}
          </span>
        )}
        <span className="text-zinc-700 text-[10px]">{collapsed ? "▼" : "▲"}</span>
      </button>

      {/* Feed */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-80 overflow-y-auto"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {events.length === 0 ? (
            <div className="px-3 py-6 text-center text-zinc-700 text-[10px] font-mono">
              Waiting for arena activity...
            </div>
          ) : (
            <div className="divide-y divide-white/[0.02]">
              {events.map((event) => (
                <div key={event.id} className="px-3 py-1.5 flex gap-2 items-start">
                  <span className="text-[9px] font-mono text-zinc-700 shrink-0 mt-0.5">
                    {formatTime(event.created_at)}
                  </span>
                  <span
                    className="text-[10px] font-mono leading-relaxed"
                    style={{ color: event.color }}
                  >
                    {event.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
