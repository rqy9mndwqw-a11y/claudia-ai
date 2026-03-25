import { encodeFunctionData } from "viem";
import type { TxStep } from "./types";

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Generate an ERC20 approval transaction step.
 * Should be called before any protocol deposit that requires token spending.
 */
export function getApproveStep(params: {
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  amount: bigint;
  tokenSymbol: string;
}): TxStep {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [params.spenderAddress, params.amount],
  });

  return {
    id: "approve",
    label: `Approve ${params.tokenSymbol}`,
    description: `Letting the protocol spend your ${params.tokenSymbol}. Standard stuff.`,
    tx: {
      to: params.tokenAddress,
      data,
    },
  };
}
