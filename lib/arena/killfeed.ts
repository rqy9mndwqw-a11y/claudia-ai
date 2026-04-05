/**
 * Live Killfeed — Bloomberg terminal meets Twitch chat.
 * All arena events flow through here for the live feed.
 */

type KillfeedFormatter = (data: Record<string, any>) => string;

export const KILLFEED_EVENTS: Record<string, { color: string; format: KillfeedFormatter }> = {
  battle_start: {
    color: "#39ff14",
    format: (d) => `⚔️ ${d.f1Name} vs ${d.f2Name} — ${d.battleType}`,
  },
  battle_win: {
    color: "#39ff14",
    format: (d) => `✓ ${d.winnerName} wins ${d.battleType} [${d.accuracy}% acc]`,
  },
  upset_win: {
    color: "#ffd700",
    format: (d) => `🎉 UPSET — ${d.winnerName} (${d.winnerTier}) beats ${d.loserName} (${d.loserTier})`,
  },
  heated_enter: {
    color: "#ff6b00",
    format: (d) => `🔥 ${d.nftName} HEATED — ${d.streak} win streak`,
  },
  heated_broken: {
    color: "#ff4400",
    format: (d) => `💔 ${d.nftName} streak broken at ${d.streak}`,
  },
  prediction_win: {
    color: "#00e5ff",
    format: (d) => `💰 Spectator win — ${d.payout} credits [${d.multiplier}×]`,
  },
  bounty_posted: {
    color: "#b44fff",
    format: (d) => `🎯 BOUNTY — ${d.reward} $CLAUDIA on ${d.target}`,
  },
  bounty_claimed: {
    color: "#ffd700",
    format: (d) => `🏆 ${d.nftName} claimed ${d.reward} $CLAUDIA bounty`,
  },
  battle_log: {
    color: "#39ff14",
    format: (d) => `"${d.log}" — ${d.nftName}`,
  },
  system_override: {
    color: "#ff2244",
    format: (d) => `⚡ SYSTEM OVERRIDE — ${d.eventName}`,
  },
  scanner_mission: {
    color: "#ff2244",
    format: (d) => `⚠️ MISSION — Scanner flagged ${d.contract} — Rug or Rip?`,
  },
};

export async function addToKillfeed(
  db: any,
  event: { type: string; data: Record<string, any> }
): Promise<void> {
  const eventDef = KILLFEED_EVENTS[event.type];
  if (!eventDef) return;

  try {
    await db.prepare(`
      INSERT INTO killfeed_events (id, type, message, metadata, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      event.type,
      eventDef.format(event.data),
      JSON.stringify(event.data),
      eventDef.color,
      Date.now()
    ).run();
  } catch (err) {
    console.error("Killfeed write error:", (err as Error).message);
  }
}
