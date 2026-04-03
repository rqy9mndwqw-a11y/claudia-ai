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
    headerText: "text-accent/60",
    activeText: "text-accent",
    activeBg: "bg-accent/10",
    activeIndicator: "bg-accent",
    hoverText: "hover:text-accent",
    iconGlow: "drop-shadow-[0_0_8px_rgba(232,41,91,0.5)]",
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
      { href: "/trade", label: "Trade", icon: "candlestick" },
      { href: "/defi", label: "DeFi", icon: "layers" },
    ],
  },
  {
    label: "Intelligence",
    color: "purple",
    items: [
      { href: "/agents", label: "Agents", icon: "bot" },
      { href: "/chat", label: "Chat", icon: "message" },
    ],
  },
  {
    label: "Resources",
    color: "amber",
    items: [
      { href: "/credits", label: "Buy Credits", icon: "coins" },
      { href: "/buy", label: "Buy $CLAUDIA", icon: "zap" },
      { href: "/agents/guide", label: "Become a Creator", icon: "sparkles", badge: "SOON" },
    ],
  },
  {
    label: "User Hub",
    color: "emerald",
    items: [
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/portfolio", label: "Portfolio", icon: "wallet" },
      { href: "/nft", label: "NFT", icon: "hexagon", badge: "SOON" },
      { href: "/stats", label: "Stats", icon: "chart" },
    ],
  },
];

// Flat list for backwards compat
export const NAV_ITEMS: NavItem[] = [
  ...NAV_STANDALONE,
  ...NAV_GROUPS.flatMap((g) => g.items),
];
