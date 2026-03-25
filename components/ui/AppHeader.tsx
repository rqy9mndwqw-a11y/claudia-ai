"use client";

import { usePathname } from "next/navigation";
import WalletConnect from "../WalletConnect";
import MobileNav from "./MobileNav";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat" },
  { href: "/defi", label: "DeFi" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/trade", label: "Trade" },
];

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-white/5">
      <div className="flex items-center gap-3">
        <MobileNav />
        <a href="/" className="font-heading font-bold text-white text-lg">
          Claudia <span className="text-accent">AI</span>
        </a>
        <nav className="hidden md:flex gap-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  isActive
                    ? "text-white bg-surface-light"
                    : "text-zinc-500 hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
      <WalletConnect />
    </header>
  );
}
