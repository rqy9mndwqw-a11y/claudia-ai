/**
 * Unified exchange interface using direct REST API calls.
 * No ccxt — keeps bundle small for Cloudflare Workers.
 */

import { createHmac, createHash } from "node:crypto";

export type ExchangeId = "kraken" | "coinbase";

export const SUPPORTED_EXCHANGES: { id: ExchangeId; name: string }[] = [
  { id: "kraken", name: "Kraken" },
  { id: "coinbase", name: "Coinbase" },
];

// ─── Kraken ────────────────────────────────────────────────────────

const KRAKEN_API = "https://api.kraken.com";

const KRAKEN_PAIRS: Record<string, string> = {
  BTC: "XXBTZUSD", ETH: "XETHZUSD", SOL: "SOLUSD", DOGE: "XDGUSD",
  ADA: "ADAUSD", AVAX: "AVAXUSD", LINK: "LINKUSD", DOT: "DOTUSD",
  MATIC: "MATICUSD", XRP: "XXRPZUSD", LTC: "XLTCZUSD", UNI: "UNIUSD",
  AAVE: "AAVEUSD", ATOM: "ATOMUSD", NEAR: "NEARUSD", OP: "OPUSD",
  ARB: "ARBUSD", SUI: "SUIUSD", APT: "APTUSD", FIL: "FILUSD",
};

function krakenSign(path: string, nonce: number, postData: string, secret: string): string {
  const hash = createHash("sha256").update(nonce + postData).digest();
  return createHmac("sha512", Buffer.from(secret, "base64"))
    .update(Buffer.concat([Buffer.from(path), hash]))
    .digest("base64");
}

async function krakenPrivate(path: string, apiKey: string, apiSecret: string, params: Record<string, string> = {}) {
  const nonce = Date.now() * 1000;
  const body = { nonce: String(nonce), ...params };
  const postData = new URLSearchParams(body).toString();
  const sig = krakenSign(path, nonce, postData, apiSecret);
  const res = await fetch(`${KRAKEN_API}${path}`, {
    method: "POST",
    headers: { "API-Key": apiKey, "API-Sign": sig, "Content-Type": "application/x-www-form-urlencoded" },
    body: postData,
  });
  const data = await res.json() as any;
  if (data.error?.length > 0) throw new Error(data.error.join(", "));
  return data.result;
}

// ─── Coinbase ──────────────────────────────────────────────────────

const COINBASE_API = "https://api.coinbase.com";

function coinbaseSign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  return createHmac("sha256", secret).update(timestamp + method + path + body).digest("hex");
}

async function coinbaseRequest(method: string, path: string, apiKey: string, apiSecret: string, body?: any) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyStr = body ? JSON.stringify(body) : "";
  const sig = coinbaseSign(timestamp, method, path, bodyStr, apiSecret);
  const res = await fetch(`${COINBASE_API}${path}`, {
    method,
    headers: {
      "CB-ACCESS-KEY": apiKey,
      "CB-ACCESS-SIGN": sig,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    },
    body: method !== "GET" ? bodyStr : undefined,
  });
  return res.json() as Promise<any>;
}

// ─── Unified Interface ─────────────────────────────────────────────

export async function verifyExchangeKey(
  exchangeId: ExchangeId, apiKey: string, apiSecret: string
): Promise<{ valid: boolean; balances: Record<string, number> }> {
  try {
    if (exchangeId === "kraken") {
      const result = await krakenPrivate("/0/private/Balance", apiKey, apiSecret);
      const balances: Record<string, number> = {};
      for (const [k, v] of Object.entries(result || {})) {
        const val = parseFloat(v as string);
        if (val > 0) balances[k] = val;
      }
      return { valid: true, balances };
    } else {
      const data = await coinbaseRequest("GET", "/v2/accounts?limit=100", apiKey, apiSecret) as any;
      const balances: Record<string, number> = {};
      for (const acct of data.data || []) {
        const val = parseFloat(acct.balance?.amount || "0");
        if (val > 0) balances[acct.balance?.currency || acct.currency?.code || "?"] = val;
      }
      return { valid: true, balances };
    }
  } catch {
    return { valid: false, balances: {} };
  }
}

export async function fetchOHLCV(
  exchangeId: ExchangeId, symbol: string, _timeframe = "1h", _limit = 100
): Promise<{ timestamps: number[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> {
  if (exchangeId === "kraken") {
    const pair = KRAKEN_PAIRS[symbol.toUpperCase()] || `${symbol.toUpperCase()}USD`;
    const res = await fetch(`${KRAKEN_API}/0/public/OHLC?pair=${pair}&interval=60`);
    const data = await res.json() as any;
    if (data.error?.length > 0) throw new Error(data.error.join(", "));
    const key = Object.keys(data.result).find((k) => k !== "last");
    if (!key) throw new Error(`No data for ${symbol}`);
    const candles = data.result[key];
    return {
      timestamps: candles.map((c: any) => c[0]),
      open: candles.map((c: any) => parseFloat(c[1])),
      high: candles.map((c: any) => parseFloat(c[2])),
      low: candles.map((c: any) => parseFloat(c[3])),
      close: candles.map((c: any) => parseFloat(c[4])),
      volume: candles.map((c: any) => parseFloat(c[6])),
    };
  } else {
    // Coinbase public candles
    const pair = `${symbol.toUpperCase()}-USD`;
    const res = await fetch(`https://api.exchange.coinbase.com/products/${pair}/candles?granularity=3600`);
    const candles = await res.json() as any;
    if (!Array.isArray(candles)) throw new Error(`No data for ${symbol}`);
    const sorted = candles.reverse(); // Coinbase returns newest first
    return {
      timestamps: sorted.map((c: any) => c[0] * 1000),
      low: sorted.map((c: any) => c[1]),
      high: sorted.map((c: any) => c[2]),
      open: sorted.map((c: any) => c[3]),
      close: sorted.map((c: any) => c[4]),
      volume: sorted.map((c: any) => c[5]),
    };
  }
}

export async function fetchTicker(
  exchangeId: ExchangeId, symbol: string
): Promise<{ price: number; bid: number; ask: number; volume24h: number }> {
  if (exchangeId === "kraken") {
    const pair = KRAKEN_PAIRS[symbol.toUpperCase()] || `${symbol.toUpperCase()}USD`;
    const res = await fetch(`${KRAKEN_API}/0/public/Ticker?pair=${pair}`);
    const data = await res.json() as any;
    if (data.error?.length > 0) throw new Error(data.error.join(", "));
    const key = Object.keys(data.result)[0];
    const t = data.result[key];
    return { price: parseFloat(t.c[0]), bid: parseFloat(t.b[0]), ask: parseFloat(t.a[0]), volume24h: parseFloat(t.v[1]) };
  } else {
    const pair = `${symbol.toUpperCase()}-USD`;
    const res = await fetch(`https://api.exchange.coinbase.com/products/${pair}/ticker`);
    const t = await res.json() as any;
    return { price: parseFloat(t.price || "0"), bid: parseFloat(t.bid || "0"), ask: parseFloat(t.ask || "0"), volume24h: parseFloat(t.volume || "0") };
  }
}

export async function placeOrder(
  exchangeId: ExchangeId, apiKey: string, apiSecret: string,
  params: { symbol: string; side: "buy" | "sell"; amount: number; price?: number; orderType?: "market" | "limit"; stopLoss?: number; takeProfit?: number }
): Promise<{ orderId: string; description: string; closeDescription?: string }> {
  const type = params.orderType || "market";

  if (exchangeId === "kraken") {
    const pair = KRAKEN_PAIRS[params.symbol.toUpperCase()] || `${params.symbol.toUpperCase()}USD`;
    const orderParams: Record<string, string> = {
      ordertype: type, type: params.side, volume: String(params.amount), pair,
    };
    if (type === "limit" && params.price) orderParams.price = String(params.price);
    if (params.stopLoss) { orderParams["close[ordertype]"] = "stop-loss"; orderParams["close[price]"] = String(params.stopLoss); }

    const result = await krakenPrivate("/0/private/AddOrder", apiKey, apiSecret, orderParams);
    const out: any = { orderId: result.txid?.[0] || "unknown", description: result.descr?.order || "Order placed" };

    if (params.stopLoss) out.closeDescription = `SL: $${params.stopLoss}`;
    if (params.takeProfit) {
      try {
        const closeSide = params.side === "buy" ? "sell" : "buy";
        await krakenPrivate("/0/private/AddOrder", apiKey, apiSecret, {
          ordertype: "take-profit", type: closeSide, volume: String(params.amount), pair, price: String(params.takeProfit),
        });
        out.closeDescription = (out.closeDescription || "") + ` | TP: $${params.takeProfit}`;
      } catch {
        out.closeDescription = (out.closeDescription || "") + ` | TP: $${params.takeProfit} (failed)`;
      }
    }
    return out;
  } else {
    // Coinbase Advanced Trade API
    const pair = `${params.symbol.toUpperCase()}-USD`;
    const orderId = `claudia-${Date.now()}`;
    const orderBody: any = {
      client_order_id: orderId,
      product_id: pair,
      side: params.side.toUpperCase(),
      order_configuration: type === "market"
        ? { market_market_ioc: { quote_size: String(params.amount) } }
        : { limit_limit_gtc: { base_size: String(params.amount), limit_price: String(params.price) } },
    };

    const data = await coinbaseRequest("POST", "/api/v3/brokerage/orders", apiKey, apiSecret, orderBody) as any;
    if (data.error || data.errors) throw new Error(data.error || data.errors?.[0]?.message || "Order failed");

    return {
      orderId: data.success_response?.order_id || orderId,
      description: `${params.side.toUpperCase()} $${params.amount} of ${params.symbol} @ market`,
      closeDescription: params.stopLoss || params.takeProfit
        ? `SL/TP not supported on Coinbase via API — set manually`
        : undefined,
    };
  }
}
