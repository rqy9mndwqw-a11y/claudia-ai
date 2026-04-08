export interface TxStep {
  id: string;
  label: string;
  description: string; // Claudia's narration
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: bigint;
  };
}

export type StepStatus = "upcoming" | "active" | "complete" | "error";

export interface DefiAdapter {
  /** Protocol name for display */
  protocol: string;

  /** Get the sequence of transactions to deposit into a pool */
  getDepositSteps(params: {
    tokenAddress: `0x${string}`;
    amount: bigint;
    userAddress: `0x${string}`;
    decimals: number;
  }): Promise<TxStep[]>;
}
