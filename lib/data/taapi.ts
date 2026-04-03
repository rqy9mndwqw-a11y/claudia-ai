/**
 * TAAPI.IO — Technical Analysis API.
 * Expert plan: 20 indicators per construct, 10 constructs per request.
 * Uses full 20-slot allocation for maximum indicator coverage.
 */

const TAAPI_BASE = "https://api.taapi.io";

export function toTaapiSymbol(pair: string): string {
  const symbol = pair.replace("/USD", "").replace("X:", "");
  return `${symbol}/USDT`;
}

export type TaapiIndicators = {
  symbol: string;
  // Price
  candle: { open: number; high: number; low: number; close: number; volume: number } | null;
  // Core momentum
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  stochrsi: { fastk: number; fastd: number } | null;
  cci: number | null;
  adx: number | null;
  mfi: number | null;
  // Volatility
  bbands: { upper: number; middle: number; lower: number } | null;
  atr: number | null;
  squeeze: number | null;
  // Volume
  obv: number | null;
  vwap: number | null;
  // Trend
  ema50: number | null;
  ema200: number | null;
  supertrend: { value: number; direction: string } | null;
  psar: number | null;
  // Momentum velocity
  roc: number | null;
  // Support/resistance
  pivotpoints: { pp: number; s1: number; s2: number; r1: number; r2: number } | null;
  // Patterns
  doji: number | null;
  engulfing: number | null;
};

/**
 * Fetch full indicator set for a single symbol.
 * Uses 20/20 indicator slots in one bulk construct.
 */
export async function getTaapiIndicators(
  pair: string,
  interval: string = "1h"
): Promise<TaapiIndicators> {
  const apiKey = process.env.TAAPI_KEY || "";
  if (!apiKey) return emptyIndicators(pair);

  const symbol = toTaapiSymbol(pair);

  try {
    const res = await fetch(`${TAAPI_BASE}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: apiKey,
        construct: {
          exchange: "binance",
          symbol,
          interval,
          indicators: [
            { id: "candle", indicator: "candle" },
            { id: "rsi", indicator: "rsi" },
            { id: "macd", indicator: "macd" },
            { id: "stochrsi", indicator: "stochrsi" },
            { id: "cci", indicator: "cci" },
            { id: "adx", indicator: "adx" },
            { id: "mfi", indicator: "mfi" },
            { id: "bbands", indicator: "bbands" },
            { id: "atr", indicator: "atr" },
            { id: "squeeze", indicator: "squeeze" },
            { id: "obv", indicator: "obv" },
            { id: "vwap", indicator: "vwap" },
            { id: "ema50", indicator: "ema", optInTimePeriod: 50 },
            { id: "ema200", indicator: "ema", optInTimePeriod: 200 },
            { id: "supertrend", indicator: "supertrend" },
            { id: "psar", indicator: "psar" },
            { id: "roc", indicator: "roc" },
            { id: "pivotpoints", indicator: "pivotpoints" },
            { id: "doji", indicator: "doji" },
            { id: "engulfing", indicator: "engulfing" },
          ],
        },
      }),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as any);

    if (!res.ok) {
      console.error(`TAAPI ${res.status} for ${symbol}`);
      return emptyIndicators(pair);
    }

    const data = (await res.json()) as any;
    const results = data.data || [];

    // Match by custom id (reliable — we assign ids to every indicator)
    const get = (id: string) => {
      const match = results.find((r: any) => r.id === id);
      return match?.result;
    };

    const macdData = get("macd");
    const bbandsData = get("bbands");
    const stochrsiData = get("stochrsi");
    const candleData = get("candle");
    const supertrendData = get("supertrend");
    const pivotData = get("pivotpoints");

    return {
      symbol,
      candle: candleData
        ? { open: candleData.open, high: candleData.high, low: candleData.low, close: candleData.close, volume: candleData.volume }
        : null,
      rsi: get("rsi")?.value ?? null,
      macd: macdData
        ? { macd: macdData.valueMACD, signal: macdData.valueMACDSignal, histogram: macdData.valueMACDHist }
        : null,
      stochrsi: stochrsiData
        ? { fastk: stochrsiData.valueFastK, fastd: stochrsiData.valueFastD }
        : null,
      cci: get("cci")?.value ?? null,
      adx: get("adx")?.value ?? null,
      mfi: get("mfi")?.value ?? null,
      bbands: bbandsData
        ? { upper: bbandsData.valueUpperBand, middle: bbandsData.valueMiddleBand, lower: bbandsData.valueLowerBand }
        : null,
      atr: get("atr")?.value ?? null,
      squeeze: get("squeeze")?.value ?? null,
      obv: get("obv")?.value ?? null,
      vwap: get("vwap")?.value ?? null,
      ema50: get("ema50")?.value ?? null,
      ema200: get("ema200")?.value ?? null,
      supertrend: supertrendData
        ? { value: supertrendData.value, direction: supertrendData.valueAdvice || "neutral" }
        : null,
      psar: get("psar")?.value ?? null,
      roc: get("roc")?.value ?? null,
      pivotpoints: pivotData
        ? { pp: pivotData.pp, s1: pivotData.s1, s2: pivotData.s2, r1: pivotData.r1, r2: pivotData.r2 }
        : null,
      doji: get("doji")?.value ?? null,
      engulfing: get("engulfing")?.value ?? null,
    };
  } catch (err) {
    console.error(`TAAPI error for ${pair}:`, (err as Error).message);
    return emptyIndicators(pair);
  }
}

/**
 * Format full indicator set for AI prompt injection.
 * Groups by category for readability.
 * All number formatting is null-safe.
 */
export function formatTaapiContext(ind: TaapiIndicators): string {
  if (!ind.rsi && !ind.candle) return "";

  // Safe number formatter — never crashes on undefined/null
  const f = (v: number | null | undefined, decimals = 2): string =>
    v != null && typeof v === "number" && !isNaN(v) ? v.toFixed(decimals) : "?";

  const lines: string[] = [`TECHNICAL ANALYSIS (${ind.symbol}):`];

  try {
    // Price
    if (ind.candle && ind.candle.close != null) {
      lines.push(`Price: $${ind.candle.close.toLocaleString()}`);
      if (ind.candle.low != null && ind.candle.high != null) {
        lines.push(`Range: $${ind.candle.low.toLocaleString()} - $${ind.candle.high.toLocaleString()}`);
      }
      if (ind.candle.volume != null) lines.push(`Volume: ${ind.candle.volume.toLocaleString()}`);
    }

    // VWAP
    if (ind.vwap != null) {
      const vs = ind.candle?.close != null ? (ind.candle.close > ind.vwap ? "above (bullish)" : "below (bearish)") : "";
      lines.push(`VWAP: $${f(ind.vwap)} — price ${vs}`);
    }

    // Momentum
    if (ind.rsi != null) {
      const sig = ind.rsi > 70 ? "OVERBOUGHT" : ind.rsi < 30 ? "OVERSOLD" : "neutral";
      lines.push(`RSI(14): ${f(ind.rsi, 1)} — ${sig}`);
    }

    if (ind.macd && ind.macd.macd != null) {
      const sig = (ind.macd.histogram ?? 0) > 0 ? "BULLISH" : "BEARISH";
      lines.push(`MACD: ${f(ind.macd.macd, 4)} | Signal: ${f(ind.macd.signal, 4)} | Hist: ${f(ind.macd.histogram, 4)} — ${sig}`);
    }

    if (ind.stochrsi && ind.stochrsi.fastk != null) {
      const sig = ind.stochrsi.fastk > 80 ? "overbought" : ind.stochrsi.fastk < 20 ? "oversold" : "neutral";
      lines.push(`StochRSI: K=${f(ind.stochrsi.fastk, 1)} D=${f(ind.stochrsi.fastd, 1)} — ${sig}`);
    }

    if (ind.cci != null) {
      const sig = ind.cci > 100 ? "overbought" : ind.cci < -100 ? "oversold" : "neutral";
      lines.push(`CCI: ${f(ind.cci, 1)} — ${sig}`);
    }

    if (ind.mfi != null) {
      const sig = ind.mfi > 80 ? "OVERBOUGHT" : ind.mfi < 20 ? "OVERSOLD" : "neutral";
      lines.push(`MFI: ${f(ind.mfi, 1)} — ${sig}`);
    }

    if (ind.roc != null) {
      lines.push(`Rate of Change: ${f(ind.roc)}%`);
    }

    // Trend
    if (ind.supertrend && ind.supertrend.value != null) {
      const dir = ind.supertrend.direction === "long" ? "BULLISH" : ind.supertrend.direction === "short" ? "BEARISH" : (ind.supertrend.direction || "neutral");
      lines.push(`Supertrend: $${f(ind.supertrend.value)} — ${dir}`);
    }

    if (ind.adx != null) {
      const str = ind.adx > 25 ? "STRONG TREND" : ind.adx > 20 ? "developing" : "weak/ranging";
      lines.push(`ADX: ${f(ind.adx, 1)} — ${str}`);
    }

    if (ind.ema50 != null && ind.ema200 != null) {
      const trend = ind.ema50 > ind.ema200 ? "BULLISH (golden cross)" : "BEARISH (death cross)";
      lines.push(`EMA50: ${f(ind.ema50)} | EMA200: ${f(ind.ema200)} — ${trend}`);
    }

    if (ind.psar != null && ind.candle?.close != null) {
      const dir = ind.candle.close > ind.psar ? "BULLISH (SAR below price)" : "BEARISH (SAR above price)";
      lines.push(`Parabolic SAR: $${f(ind.psar)} — ${dir}`);
    }

    // Volatility
    if (ind.bbands && ind.bbands.upper != null) {
      lines.push(`Bollinger: Upper $${f(ind.bbands.upper)} | Mid $${f(ind.bbands.middle)} | Lower $${f(ind.bbands.lower)}`);
      if (ind.candle?.close != null) {
        if (ind.bbands.lower != null && ind.candle.close < ind.bbands.lower) lines.push("  -> Price BELOW lower band (oversold signal)");
        if (ind.bbands.upper != null && ind.candle.close > ind.bbands.upper) lines.push("  -> Price ABOVE upper band (overbought signal)");
      }
    }

    if (ind.atr != null) lines.push(`ATR: ${f(ind.atr, 4)} (volatility measure)`);

    if (ind.squeeze != null) {
      lines.push(`Squeeze: ${ind.squeeze === 0 ? "SQUEEZE ON (big move incoming)" : "no squeeze"}`);
    }

    // Volume
    if (ind.obv != null) lines.push(`OBV: ${f(ind.obv, 0)}`);

    // Support/Resistance
    if (ind.pivotpoints && ind.pivotpoints.pp != null) {
      lines.push(`Pivot Points: R2=$${f(ind.pivotpoints.r2)} R1=$${f(ind.pivotpoints.r1)} PP=$${f(ind.pivotpoints.pp)} S1=$${f(ind.pivotpoints.s1)} S2=$${f(ind.pivotpoints.s2)}`);
    }

    // Patterns
    const patterns: string[] = [];
    if (ind.doji && ind.doji !== 0) patterns.push("Doji (indecision)");
    if (ind.engulfing && ind.engulfing > 0) patterns.push("Bullish Engulfing");
    if (ind.engulfing && ind.engulfing < 0) patterns.push("Bearish Engulfing");
    if (patterns.length > 0) lines.push(`Candlestick Patterns: ${patterns.join(", ")}`);
  } catch (err) {
    console.error("formatTaapiContext error:", (err as Error).message);
  }

  return lines.join("\n");
}

function emptyIndicators(pair: string): TaapiIndicators {
  return {
    symbol: toTaapiSymbol(pair),
    candle: null, rsi: null, macd: null, stochrsi: null, cci: null,
    adx: null, mfi: null, bbands: null, atr: null, squeeze: null,
    obv: null, vwap: null, ema50: null, ema200: null, supertrend: null,
    psar: null, roc: null, pivotpoints: null, doji: null, engulfing: null,
  };
}
