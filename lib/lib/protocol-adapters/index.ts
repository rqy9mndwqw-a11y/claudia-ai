import type { Position, ProtocolAdapter } from "./types";
import { aaveAdapter } from "./aave";
import { aerodromeAdapter } from "./aerodrome";

export type { Position, ProtocolAdapter };

const adapters: ProtocolAdapter[] = [
  aaveAdapter,
  aerodromeAdapter,
];

/**
 * Run all protocol adapters and aggregate positions.
 * Failures in individual adapters are silently caught — partial results are fine.
 */
export async function getAllPositions(address: `0x${string}`): Promise<Position[]> {
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.getPositions(address))
  );

  const positions: Position[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      positions.push(...result.value);
    }
  }

  // Sort by value descending
  positions.sort((a, b) => b.currentValue - a.currentValue);
  return positions;
}
