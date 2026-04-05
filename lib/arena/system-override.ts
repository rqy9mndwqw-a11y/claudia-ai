/**
 * System Override — random daily events that buff skills/battle types for 1 hour.
 */

export const OVERRIDE_EVENTS = [
  {
    id: "memecoin_surge",
    name: "MEMECOIN SURGE",
    description: "Memecoin Radar skill boosted 50% for all agents.",
    effect: { skillBoost: "memecoin_radar", multiplier: 1.5 },
    glitchColor: "#ff6b35",
  },
  {
    id: "alpha_window",
    name: "ALPHA WINDOW",
    description: "Alpha Race battles yield 2× Signal Strength rewards.",
    effect: { battleTypeBoost: "alpha_race", signalMultiplier: 2 },
    glitchColor: "#39ff14",
  },
  {
    id: "rug_season",
    name: "RUG SEASON",
    description: "Rug or Rip missions active. All rug detection accuracy +30%.",
    effect: { skillBoost: "rug_detector", multiplier: 1.3, missionSpawn: true },
    glitchColor: "#ff2244",
  },
  {
    id: "bear_trap",
    name: "BEAR TRAP",
    description: "Bear/Bull Bout battles pay 3× credits for correct calls.",
    effect: { battleTypeBoost: "bear_bull", creditMultiplier: 3 },
    glitchColor: "#00e5ff",
  },
  {
    id: "chart_overload",
    name: "CHART OVERLOAD",
    description: "Chart Reader at maximum sensitivity. Signal Duels yield double XP.",
    effect: { skillBoost: "chart_reader", multiplier: 1.5, battleTypeBoost: "signal_duel", signalMultiplier: 2 },
    glitchColor: "#ffd700",
  },
  {
    id: "whale_alert",
    name: "WHALE ALERT",
    description: "Whale Watch skill active for all agents regardless of skill level.",
    effect: { universalSkill: "whale_watch", level: 3 },
    glitchColor: "#b44fff",
  },
  {
    id: "iron_protocol",
    name: "IRON PROTOCOL",
    description: "No Signal Strength loss from battles for 1 hour. Go reckless.",
    effect: { noDegradation: true },
    glitchColor: "#888",
  },
] as const;

export type OverrideEvent = (typeof OVERRIDE_EVENTS)[number];

export function pickRandomOverride(): OverrideEvent {
  return OVERRIDE_EVENTS[Math.floor(Math.random() * OVERRIDE_EVENTS.length)];
}
