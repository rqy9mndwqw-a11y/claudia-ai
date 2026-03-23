/**
 * Unified exchange interface.
 * Uses ccxt individual exchange imports to keep bundle small.
 */

// Direct imports to avoid bundling all 100+ exchanges
// @ts-expect-error — ccxt subpath imports work at runtime
import Kraken from "ccxt/js/src/kraken.js";
// @ts-expect-error
import Coinbase from "ccxt/js/src/coinbase.js";

export type ExchangeId = "kraken" | "coinbase";

export const SUPPORTED_EXCHANGES: { id: ExchangeId; name: string; notes: string }[] = [
  { id: "kraken", name: "Kraken", notes: "API key with Trade + Query permissions" },
  { id: "coinbase", name: "Coinbase Advanced", notes: "API key with Trade permissions" },
];

function createExchange(
  exchangeId: ExchangeId,
  apiKey: string,
  apiSecret: string
): any {
  const opts = { apiKey, secret: apiSecret, enableRateLimit: true };

  switch (exchangeId) {
    case "kraken":
      return new Kraken(opts);
    case "coinbase":
      return new Coinbase(opts);
    default:
      throw new Error(`Unsupported exchange: ${exchangeId}`);
  }
}

/** Verify API key by fetching balance */
export async function verifyExchangeKey(
  exchangeId: ExchangeId,
  apiKey: string,
  apiSecret: string
): Promise<{ valid: boolean; balances: Record<string, number> }> {
  try {
    const exchange = createExchange(exchangeId, apiKey, apiSecret);
    const balance = await exchange.fetchBalance();

    const balances: Record<string, number> = {};
    for (const [k, v] of Object.entries(balance.total || {})) {
      const val = Number(v);
      if (val > 0) balances[k] = val;
    }

    return { valid: true, balances };
  } catch {
    return { valid: false, balances: {} };
  }
}

/** Fetch OHLCV data (public, no auth needed) */
export async function fetchOHLCV(
  exchangeId: ExchangeId,
  symbol: string,
  timeframe = "1h",
  limit = 100
): Promise<{
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}> {
  const exchange = createExchange(exchangeId, "", "");
  const pair = `${symbol.toUpperCase()}/USD`;
  const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, limit);

  return {
    timestamps: ohlcv.map((c) => c[0] as number),
    open: ohlcv.map((c) => c[1] as number),
    high: ohlcv.map((c) => c[2] as number),
    low: ohlcv.map((c) => c[3] as number),
    close: ohlcv.map((c) => c[4] as number),
    volume: ohlcv.map((c) => c[5] as number),
  };
}

/** Fetch ticker price */
export async function fetchTicker(
  exchangeId: ExchangeId,
  symbol: string
): Promise<{ price: number; bid: number; ask: number; volume24h: number }> {
  const exchange = createExchange(exchangeId, "", "");
  const pair = `${symbol.toUpperCase()}/USD`;
  const ticker = await exchange.fetchTicker(pair);

  return {
    price: ticker.last || 0,
    bid: ticker.bid || 0,
    ask: ticker.ask || 0,
    volume24h: (ticker.quoteVolume || ticker.baseVolume || 0),
  };
}

/** Place an order with optional stop-loss and take-profit */
export async function placeOrder(
  exchangeId: ExchangeId,
  apiKey: string,
  apiSecret: string,
  params: {
    symbol: string;
    side: "buy" | "sell";
    amount: number;
    price?: number;
    orderType?: "market" | "limit";
    stopLoss?: number;
    takeProfit?: number;
  }
): Promise<{ orderId: string; description: string; closeDescription?: string }> {
  const exchange = createExchange(exchangeId, apiKey, apiSecret);
  const pair = `${params.symbol.toUpperCase()}/USD`;
  const type = params.orderType || "market";

  const order = await exchange.createOrder(
    pair,
    type,
    params.side,
    params.amount,
    type === "limit" ? params.price : undefined
  );

  const result: { orderId: string; description: string; closeDescription?: string } = {
    orderId: order.id || "unknown",
    description: `${params.side.toUpperCase()} ${params.amount} ${params.symbol} @ ${type === "market" ? "market" : `$${params.price}`}`,
  };

  const closeSide = params.side === "buy" ? "sell" : "buy";
  const slTpParts: string[] = [];

  if (params.stopLoss) {
    try {
      await exchange.createOrder(
        pair,
        "stop-loss",
        closeSide,
        params.amount,
        undefined,
        { stopPrice: params.stopLoss, triggerPrice: params.stopLoss }
      );
      slTpParts.push(`SL: $${params.stopLoss}`);
    } catch {
      slTpParts.push(`SL: $${params.stopLoss} (failed — place manually)`);
    }
  }

  if (params.takeProfit) {
    try {
      await exchange.createOrder(
        pair,
        "take-profit",
        closeSide,
        params.amount,
        undefined,
        { stopPrice: params.takeProfit, triggerPrice: params.takeProfit }
      );
      slTpParts.push(`TP: $${params.takeProfit}`);
    } catch {
      slTpParts.push(`TP: $${params.takeProfit} (failed — place manually)`);
    }
  }

  if (slTpParts.length > 0) {
    result.closeDescription = slTpParts.join(" | ");
  }

  return result;
}
