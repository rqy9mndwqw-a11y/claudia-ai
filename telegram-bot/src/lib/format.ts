export function formatPrice(price?: number): string {
  if (!price) return "?";
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

export function scoreEmoji(score: number): string {
  if (score >= 7) return "\u{1F7E2}"; // green
  if (score >= 4) return "\u26AA";     // white
  return "\u{1F534}";                  // red
}

export function rankEmoji(rank: number): string {
  if (rank === 1) return "\u{1F947}"; // gold
  if (rank === 2) return "\u{1F948}"; // silver
  if (rank === 3) return "\u{1F949}"; // bronze
  return `${rank}.`;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
