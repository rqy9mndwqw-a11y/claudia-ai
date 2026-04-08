/**
 * FRED API — Federal Reserve Economic Data.
 * Free, no API key required for CSV endpoints.
 * Replaces Polygon's getEconomicContext.
 */

export type FredEconomicContext = {
  treasury2y: number | null;
  treasury10y: number | null;
  treasury30y: number | null;
  fedFundsRate: number | null;
  yieldCurveInverted: boolean;
  spread2s10s: number | null;
  fetchedAt: number;
};

async function fredLatestValue(seriesId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`,
      { cf: { cacheTtl: 3600, cacheEverything: true } } as any
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const lastLine = lines[lines.length - 1];
    const value = parseFloat(lastLine.split(",")[1]);
    return isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

export async function getFredEconomicContext(): Promise<FredEconomicContext> {
  const [t2y, t10y, t30y, ff] = await Promise.allSettled([
    fredLatestValue("DGS2"),
    fredLatestValue("DGS10"),
    fredLatestValue("DGS30"),
    fredLatestValue("FEDFUNDS"),
  ]);

  const treasury2y = t2y.status === "fulfilled" ? t2y.value : null;
  const treasury10y = t10y.status === "fulfilled" ? t10y.value : null;
  const treasury30y = t30y.status === "fulfilled" ? t30y.value : null;
  const fedFundsRate = ff.status === "fulfilled" ? ff.value : null;

  const yieldCurveInverted = treasury2y !== null && treasury10y !== null ? treasury2y > treasury10y : false;
  const spread2s10s = treasury2y !== null && treasury10y !== null
    ? Math.round((treasury10y - treasury2y) * 1000) / 1000
    : null;

  return { treasury2y, treasury10y, treasury30y, fedFundsRate, yieldCurveInverted, spread2s10s, fetchedAt: Date.now() };
}

export function formatFredContext(ctx: FredEconomicContext): string {
  const lines = ["MACRO CONTEXT (FRED):"];
  if (ctx.treasury2y !== null) lines.push(`2Y Treasury: ${ctx.treasury2y.toFixed(2)}%`);
  if (ctx.treasury10y !== null) lines.push(`10Y Treasury: ${ctx.treasury10y.toFixed(2)}%`);
  if (ctx.treasury30y !== null) lines.push(`30Y Treasury: ${ctx.treasury30y.toFixed(2)}%`);
  if (ctx.fedFundsRate !== null) lines.push(`Fed Funds Rate: ${ctx.fedFundsRate.toFixed(2)}%`);
  if (ctx.spread2s10s !== null) {
    const curve = ctx.yieldCurveInverted ? "INVERTED (recession signal)" : "NORMAL";
    lines.push(`Yield Curve (10Y-2Y): ${ctx.spread2s10s.toFixed(3)}% — ${curve}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}
