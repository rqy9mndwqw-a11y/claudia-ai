import type { Position, ProtocolAdapter } from "./types";

/**
 * Aerodrome adapter for Base.
 *
 * Aerodrome LP positions are harder to detect generically because:
 * - LP token addresses are per-pool (no master list without an indexer)
 * - Gauge addresses vary per pool
 * - Need to know which pools the user has interacted with
 *
 * For MVP, this adapter is a placeholder that returns empty.
 * To make it functional, we'd need either:
 * 1. An indexer/subgraph query for the user's LP positions
 * 2. A hardcoded list of popular gauge addresses to check
 * 3. Parsing transfer events from the Aerodrome factory
 *
 * We'll add real Aerodrome position detection when we have
 * the subgraph integration or popular gauge list.
 */
export const aerodromeAdapter: ProtocolAdapter = {
  protocol: "Aerodrome",

  async getPositions(_address: `0x${string}`): Promise<Position[]> {
    // TODO: Implement when we have Aerodrome subgraph or gauge list
    // For now, Aave positions cover the most common Base DeFi usage
    return [];
  },
};
