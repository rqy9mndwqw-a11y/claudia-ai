export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
};

export type NavGroup = {
  label: string;
  color: GroupColor;
  items: NavItem[];
};

// Group color tokens — used for hover glows, active states, and header text
export type GroupColor = "accent" | "blue" | "purple" | "emerald" | "amber";

export const GROUP_STYLES: Record<GroupColor, {
  headerText: string;
  activeText: string;
  activeBg: string;
  activeIndicator: string;
  hoverText: string;
  iconGlow: string;
}> = {
  accent: {
    headerText: "text-base-blue/60",
    activeText: "text-base-blue",
    activeBg: "bg-base-blue/10",
    activeIndicator: "bg-base-blue",
    hoverText: "hover:text-base-blue",
    iconGlow: "drop-shadow-[0_0_8px_rgba(0,82,255,0.5)]",
  },
  blue: {
    headerText: "text-blue-400/60",
    activeText: "text-blue-400",
    activeBg: "bg-blue-400/10",
    activeIndicator: "bg-blue-400",
    hoverText: "hover:text-blue-400",
    iconGlow: "drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]",
  },
  purple: {
    headerText: "text-purple-400/60",
    activeText: "text-purple-400",
    activeBg: "bg-purple-400/10",
    activeIndicator: "bg-purple-400",
    hoverText: "hover:text-purple-400",
    iconGlow: "drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]",
  },
  emerald: {
    headerText: "text-emerald-400/60",
    activeText: "text-emerald-400",
    activeBg: "bg-emerald-400/10",
    activeIndicator: "bg-emerald-400",
    hoverText: "hover:text-emerald-400",
    iconGlow: "drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  },
  amber: {
    headerText: "text-amber-400/60",
    activeText: "text-amber-400",
    activeBg: "bg-amber-400/10",
    activeIndicator: "bg-amber-400",
    hoverText: "hover:text-amber-400",
    iconGlow: "drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]",
  },
};

// Standalone items (rendered outside groups)
export const NAV_STANDALONE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/feed", label: "Feed", icon: "radio" },
  { href: "/leaderboard", label: "Leaderboard", icon: "trophy" },
];

// Standalone (Leaderboard) uses amber for prestige/gold feel
export const STANDALONE_COLOR: GroupColor = "amber";

// Grouped navigation
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Market",
    color: "blue",
    items: [
      { href: "/scanner", label: "Scanner", icon: "radar" },
      { href: "/bot/performance", label: "Bot", icon: "chart" },
      { href: "/trade", label: "Trade", icon: "candlestick" },
      { href: "/defi", label: "DeFi", icon: "layers" },
      { href: "/compare", label: "Compare", icon: "columns" },
    ],
  },
  {
    label: "Signal Pit",
    color: "accent",
    items: [
      { href: "/arena", label: "Arena Home", icon: "swords" },
      { href: "/arena/create", label: "Create Duel", icon: "plus" },
      { href: "/arena/ai-challenge", label: "Challenge AI", icon: "bot" },
      { href: "/arena/leaderboard", label: "Leaderboard", icon: "trophy" },
      { href: "/hall-of-flame", label: "Hall of Flame", icon: "flame" },
      { href: "/referrals", label: "Invite & Earn", icon: "gift" },
    ],
  },
  {
    label: "Intelligence",
    color: "purple",
    items: [
      { href: "/agents", label: "Agents", icon: "bot" },
      { href: "/chat", label: "Chat", icon: "message" },
      { href: "/rug-check", label: "Rug Check", icon: "shield" },
      { href: "/whale-alert", label: "Whale Alert", icon: "waves" },
      { href: "/roast", label: "Wallet Roast", icon: "flame" },
    ],
  },
  {
    label: "Resources",
    color: "amber",
    items: [
      { href: "/credits", label: "Buy Credits", icon: "coins" },
      { href: "/buy", label: "Buy $CLAUDIA", icon: "zap" },
      { href: "/docs", label: "Docs", icon: "book" },
      { href: "/agents/guide", label: "Become a Creator", icon: "sparkles", badge: "SOON" },
    ],
  },
  {
    label: "User Hub",
    color: "emerald",
    items: [
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/portfolio", label: "Portfolio", icon: "wallet" },
      { href: "/watchlist", label: "Watchlist", icon: "eye" },
      { href: "/nft", label: "NFT", icon: "hexagon", badge: "SOON" },
      { href: "/oracle", label: "Oracle", icon: "eye" },
      { href: "/stats", label: "Stats", icon: "chart" },
    ],
  },
];

// Flat list for backwards compat
export const NAV_ITEMS: NavItem[] = [
  ...NAV_STANDALONE,
  ...NAV_GROUPS.flatMap((g) => g.items),
];
