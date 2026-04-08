import type { DefiAdapter, TxStep } from "./types";

/**
 * Aerodrome adapter placeholder.
 *
 * LP deposits on Aerodrome are significantly more complex than single-asset lending:
 * - Need both tokens in the pair
 * - Must calculate optimal amounts based on pool reserves
 * - Slippage tolerance for min amounts
 * - Different flow for stable vs volatile pools
 * - Optional gauge staking after LP deposit
 *
 * This will be implemented in a follow-up when we add:
 * - Pool reserve fetching (for optimal ratio calculation)
 * - Token swap integration (if user only has one side)
 * - Gauge address mapping for reward staking
 */
export const aerodromeDefiAdapter: DefiAdapter = {
  protocol: "Aerodrome",

  async getDepositSteps(): Promise<TxStep[]> {
    throw new Error("Aerodrome deposits not yet supported. Coming soon.");
  },
};
