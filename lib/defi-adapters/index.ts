import type { DefiAdapter } from "./types";
import { aaveDefiAdapter } from "./aave-adapter";

export type { TxStep, StepStatus, DefiAdapter } from "./types";

const adapters: Record<string, DefiAdapter> = {
  "aave-v3": aaveDefiAdapter,
  // "aerodrome-v1": aerodromeDefiAdapter,  // Not yet implemented
  // "aerodrome-v2": aerodromeDefiAdapter,
};

/**
 * Get a DeFi adapter for a protocol. Returns null if not supported.
 * Protocol name is matched case-insensitively with hyphen normalization.
 */
export function getDefiAdapter(protocol: string): DefiAdapter | null {
  const key = protocol.toLowerCase().replace(/\s+/g, "-");
  return adapters[key] ?? null;
}

/** Check if a protocol supports deposits */
export function supportsDeposit(protocol: string): boolean {
  return getDefiAdapter(protocol) !== null;
}
