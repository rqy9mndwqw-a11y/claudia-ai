/**
 * Kraken REST API client — runs server-side only.
 * Uses direct fetch instead of ccxt to keep Worker bundle small.
 */

import { createHmac, createHash } from "node:crypto";

const KRAKEN_API = "https://api.kraken.com";

// Kraken pair mappings
const PAIR_MAP: Record<string, string> = {
  BTC: "XXBTZUSD",
  ETH: "XETHZUSD",
  SOL: "SOLUSD",
  DOGE: "XDGUSD",
  ADA: "ADAUSD",
  AVAX: "AVAXUSD",
  LINK: "LINKUSD",
  DOT: "DOTUSD",
  MATIC: "MATICUSD",
  XRP: "XXRPZUSD",
  LTC: "XLTCZUSD",
  UNI: "UNIUSD",
  AAVE: "AAVEUSD",
  ATOM: "ATOMUSD",
  NEAR: "NEARUSD",
  OP: "OPUSD",
  ARB: "ARBUSD",
  SUI: "SUIUSD",
  APT: "APTUSD",
  FIL: "FILUSD",
};

export const SUPPORTED_PAIRS = Object.keys(PAIR_MAP);

function getKrakenPair(symbol: string): string {
  return PAIR_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USD`;
}

/** Sign a Kraken private API request */
function signRequest(
  path: string,
  nonce: number,
  postData: string,
  apiSecret: string
): string {
  const message = nonce + postData;
  const hash = createHash("sha256").update(message).digest();
  const hmac = createHmac("sha512", Buffer.from(apiSecret, "base64"));
  hmac.update(Buffer.concat([Buffer.from(path), hash]));
  return hmac.digest("base64");
}

/** Fetch public OHLCV data from Kraken */
export async function fetchOHLCV(
  symbol: string,
  interval = 60 // 1 hour candles
): Promise<{
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  timestamps: number[];
}> {
  const pair = getKrakenPair(symbol);
  const res = await fetch(
    `${KRAKEN_API}/0/public/OHLC?pair=${pair}&interval=${interval}`
  );
  const data = await res.json() as any;

  if (data.error?.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(", ")}`);
  }

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
}

/** Fetch current ticker price */
export async function fetchTicker(
  symbol: string
): Promise<{ price: number; bid: number; ask: number; volume24h: number }> {
  const pair = getKrakenPair(symbol);
  const res = await fetch(`${KRAKEN_API}/0/public/Ticker?pair=${pair}`);
  const data = await res.json() as any;

  if (data.error?.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(", ")}`);
  }

  const key = Object.keys(data.result)[0];
  const t = data.result[key];
  return {
    price: parseFloat(t.c[0]),
    bid: parseFloat(t.b[0]),
    ask: parseFloat(t.a[0]),
    volume24h: parseFloat(t.v[1]),
  };
}

/** Place an order on Kraken with optional stop-loss and take-profit */
export async function placeOrder(
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
  const nonce = Date.now() * 1000;
  const pair = getKrakenPair(params.symbol);
  const type = params.orderType || "market";

  const body: Record<string, string> = {
    nonce: String(nonce),
    ordertype: type,
    type: params.side,
    volume: String(params.amount),
    pair,
  };

  if (type === "limit" && params.price) {
    body.price = String(params.price);
  }

  // Kraken conditional close: attach stop-loss to the entry order
  // close[ordertype] = stop-loss-limit or take-profit-limit
  if (params.stopLoss && params.takeProfit) {
    // Use stop-loss with take-profit: Kraken supports this via close params
    // Primary close is stop-loss, we'll place TP as separate order
    body["close[ordertype]"] = "stop-loss";
    body["close[price]"] = String(params.stopLoss);
  } else if (params.stopLoss) {
    body["close[ordertype]"] = "stop-loss";
    body["close[price]"] = String(params.stopLoss);
  } else if (params.takeProfit) {
    body["close[ordertype]"] = "take-profit";
    body["close[price]"] = String(params.takeProfit);
  }

  const postData = new URLSearchParams(body).toString();
  const path = "/0/private/AddOrder";
  const signature = signRequest(path, nonce, postData, apiSecret);

  const res = await fetch(`${KRAKEN_API}${path}`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "API-Sign": signature,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });

  const data = await res.json() as any;

  if (data.error?.length > 0) {
    throw new Error(data.error.join(", "));
  }

  const result: { orderId: string; description: string; closeDescription?: string } = {
    orderId: data.result.txid?.[0] || "unknown",
    description: data.result.descr?.order || "Order placed",
    closeDescription: data.result.descr?.close || undefined,
  };

  // If both SL and TP, place TP as a separate conditional order
  if (params.stopLoss && params.takeProfit) {
    try {
      const tpNonce = Date.now() * 1000 + 1;
      const closeSide = params.side === "buy" ? "sell" : "buy";
      const tpBody: Record<string, string> = {
        nonce: String(tpNonce),
        ordertype: "take-profit",
        type: closeSide,
        volume: String(params.amount),
        pair,
        price: String(params.takeProfit),
      };
      const tpPostData = new URLSearchParams(tpBody).toString();
      const tpSignature = signRequest(path, tpNonce, tpPostData, apiSecret);

      await fetch(`${KRAKEN_API}${path}`, {
        method: "POST",
        headers: {
          "API-Key": apiKey,
          "API-Sign": tpSignature,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tpPostData,
      });

      result.closeDescription = `SL: $${params.stopLoss} | TP: $${params.takeProfit}`;
    } catch {
      // TP failed but main order + SL went through
      result.closeDescription = `SL: $${params.stopLoss} (TP order failed — place manually)`;
    }
  }

  return result;
}

/** Verify API key works by checking balance */
export async function verifyApiKey(
  apiKey: string,
  apiSecret: string
): Promise<{ valid: boolean; balances: Record<string, number> }> {
  const nonce = Date.now() * 1000;
  const postData = `nonce=${nonce}`;
  const path = "/0/private/Balance";
  const signature = signRequest(path, nonce, postData, apiSecret);

  const res = await fetch(`${KRAKEN_API}${path}`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "API-Sign": signature,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });

  const data = await res.json() as any;

  if (data.error?.length > 0) {
    return { valid: false, balances: {} };
  }

  const balances: Record<string, number> = {};
  for (const [k, v] of Object.entries(data.result || {})) {
    const val = parseFloat(v as string);
    if (val > 0) balances[k] = val;
  }

  return { valid: true, balances };
}
