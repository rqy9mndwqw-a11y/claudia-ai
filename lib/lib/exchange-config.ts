/**
 * Exchange configuration — safe for client-side import (no node:crypto).
 * Use this file in components. Use lib/exchange.ts for server-side API calls.
 */

export type ExchangeId = "kraken" | "coinbase" | "bybit" | "binance" | "binanceus" | "okx" | "gateio" | "mexc";

export const SUPPORTED_EXCHANGES: { id: ExchangeId; name: string }[] = [
  { id: "kraken", name: "Kraken" },
  { id: "coinbase", name: "Coinbase" },
  { id: "bybit", name: "Bybit" },
  { id: "binance", name: "Binance" },
  { id: "binanceus", name: "Binance US" },
  { id: "okx", name: "OKX" },
  { id: "gateio", name: "Gate.io" },
  { id: "mexc", name: "MEXC" },
];
