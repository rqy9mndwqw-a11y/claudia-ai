export interface Position {
  protocol: string;
  pool: string;
  tokens: string[];
  currentValue: number; // USD
  apy: number | null;   // current APY from DeFiLlama (null if unknown)
  chain: string;
  /** Raw balance in token units (for display) */
  balance: string;
  /** Address of the position token (aToken, LP token, etc.) */
  tokenAddress: `0x${string}`;
}

export interface ProtocolAdapter {
  protocol: string;
  /** Read all positions for a wallet address. Returns empty array if none found. */
  getPositions(address: `0x${string}`): Promise<Position[]>;
}
