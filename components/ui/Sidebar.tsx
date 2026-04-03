"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NavIcon from "./NavIcon";
import { NAV_STANDALONE, NAV_GROUPS, STANDALONE_COLOR, GROUP_STYLES } from "@/lib/nav-items";
import type { NavItem, GroupColor } from "@/lib/nav-items";

export const SIDEBAR_COLLAPSED_PX = 72;
export const SIDEBAR_EXPANDED_PX = 260;

const COLLAPSED_W = "w-[72px]";
const EXPANDED_W = "w-[260px]";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export default function Sidebar({ expanded, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const isActive = (href: string) => pathname?.startsWith(href);

  // Render a nav item with group-specific colors
  function renderItem(item: NavItem, color: GroupColor, isExpanded: boolean) {
    const isExternal = item.href.startsWith("http");
    const active = !isExternal && isActive(item.href);
    const styles = GROUP_STYLES[color];

    const hasBadge = !!item.badge;
    const className = `group relative flex items-center gap-3 rounded-lg transition-all duration-150 ${
      isExpanded ? "px-3 py-2" : "justify-center px-0 py-2.5"
    } ${hasBadge ? "opacity-50" : ""} ${
      active
        ? `text-white ${styles.activeBg}`
        : `text-zinc-500 ${styles.hoverText} hover:bg-white/[0.04]`
    }`;

    const content = (
      <>
        {active && (
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${styles.activeIndicator}`} />
        )}

        <div
          className={`flex-shrink-0 transition-all duration-150 ${
            active ? `${styles.activeText} ${styles.iconGlow}` : ""
          }`}
        >
          <NavIcon name={item.icon} />
        </div>

        {isExpanded && (
          <span className={`text-sm font-medium truncate transition-opacity duration-150 ${active ? "text-white" : ""}`}>
            {item.label}
          </span>
        )}

        {isExpanded && item.badge && (
          <span className="text-[8px] font-mono font-bold text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">
            {item.badge}
          </span>
        )}

        {isExternal && isExpanded && !item.badge && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto text-zinc-600 flex-shrink-0">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        )}
      </>
    );

    if (isExternal) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          title={!isExpanded ? item.label : undefined}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={className}
        aria-current={active ? "page" : undefined}
        title={!isExpanded ? item.label : undefined}
      >
        {content}
      </Link>
    );
  }

  // Shared nav content renderer (used by both desktop sidebar and mobile drawer)
  function renderNav(isExpanded: boolean) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1" aria-label="Main navigation">
        {NAV_STANDALONE.map((item) => renderItem(item, STANDALONE_COLOR, isExpanded))}

        <div className="h-px bg-white/5 my-2" />

        {NAV_GROUPS.map((group) => {
          const styles = GROUP_STYLES[group.color];
          return (
            <div key={group.label} className="space-y-0.5">
              {isExpanded ? (
                <p className={`text-[10px] font-bold uppercase tracking-widest px-3 pt-3 pb-1 ${styles.headerText}`}>
                  {group.label}
                </p>
              ) : (
                <div className="h-px bg-white/5 my-1.5" />
              )}
              {group.items.map((item) => renderItem(item, group.color, isExpanded))}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-[70] p-2 text-zinc-400 hover:text-white transition-colors bg-bg/80 backdrop-blur-sm rounded-lg border border-white/5"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setMobileOpen(false)} />
          <aside
            className="fixed top-0 left-0 bottom-0 w-[260px] bg-bg border-r border-white/5 z-[90] animate-slide-in"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <img src="/claudia-logo.svg" alt="CLAUDIA" className="h-6 w-auto" />
                    </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 text-zinc-500 hover:text-white transition-colors"
                  aria-label="Close navigation"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {renderNav(true)}
            </div>
          </aside>
        </>
      )}

      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 bg-bg border-r border-white/5 z-40 transition-all duration-300 ease-in-out ${
          expanded ? EXPANDED_W : COLLAPSED_W
        }`}
        role="navigation"
        aria-label="Sidebar navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center border-b border-white/5 ${expanded ? "px-4 py-3.5 gap-2.5" : "justify-center py-3.5"}`}>
            <img
              src="/claudia-logo.svg"
              alt="CLAUDIA"
              className={`transition-all duration-200 ${expanded ? "h-6 w-auto" : "h-5 w-auto"}`}
            />
          </div>

          {renderNav(expanded)}

          {/* Collapse toggle */}
          <div className="border-t border-white/5 p-2">
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors"
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
              >
                <path d="m11 17-5-5 5-5" />
                <path d="m18 17-5-5 5-5" />
              </svg>
              {expanded && <span className="text-xs">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
