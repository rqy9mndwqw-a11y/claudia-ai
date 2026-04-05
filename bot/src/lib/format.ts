export function formatScanResults(scan: any): string {
  if (!scan) return "no scan data yet. check back later.";

  const results = JSON.parse(scan.results || "[]");
  const topPicks = JSON.parse(scan.top_picks || "[]");
  const mood = scan.market_mood || "unknown";
  const pairCount = scan.pair_count || 0;
  const scannedAt = scan.scanned_at;
  const minsAgo = Math.floor((Date.now() - scannedAt) / 60000);
  const timeStr = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ${minsAgo % 60}m ago`;

  if (topPicks.length === 0) {
    return `scanned ${pairCount} pairs ${timeStr}. nothing worth your attention right now.\n\ncheck back in 2 hours.`;
  }

  const scoreEmoji = (s: number) => s >= 7 ? "\u{1F7E2}" : s >= 4 ? "\u{1F7E1}" : "\u{1F534}";

  const picks = topPicks.slice(0, 5).map((p: any) =>
    `${scoreEmoji(p.score)} <b>${p.symbol}</b> \u2014 ${p.score}/10`
  ).join("\n");

  return [
    `scanned ${pairCount} pairs ${timeStr}. here's what stands out:`,
    "",
    picks,
    "",
    `mood: ${mood}`,
    "",
    `full breakdown: app.claudia.wtf/scanner`,
    "",
    `scores based on RSI, MACD, BB + more.`,
    `DYOR. this is data, not advice.`,
  ].join("\n");
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
