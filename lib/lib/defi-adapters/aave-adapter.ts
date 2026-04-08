import { encodeFunctionData } from "viem";
import { AAVE_POOL_ADDRESS } from "../contracts";
import { getApproveStep } from "./erc20-approve";
import type { TxStep, DefiAdapter } from "./types";

const AAVE_SUPPLY_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
] as const;

/**
 * Aave V3 adapter for Base.
 * Deposit flow: Approve token → Supply to Aave Pool
 */
export const aaveDefiAdapter: DefiAdapter = {
  protocol: "Aave V3",

  async getDepositSteps({ tokenAddress, amount, userAddress, decimals }) {
    const steps: TxStep[] = [];

    // Step 1: Approve the Aave Pool to spend tokens
    // Find the token symbol from the address for display
    const symbolMap: Record<string, string> = {
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
      "0x4200000000000000000000000000000000000006": "WETH",
      "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "cbETH",
      "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC",
    };
    const symbol = symbolMap[tokenAddress.toLowerCase()] || "Token";

    steps.push(
      getApproveStep({
        tokenAddress,
        spenderAddress: AAVE_POOL_ADDRESS,
        amount,
        tokenSymbol: symbol,
      })
    );

    // Step 2: Supply to Aave
    const supplyData = encodeFunctionData({
      abi: AAVE_SUPPLY_ABI,
      functionName: "supply",
      args: [tokenAddress, amount, userAddress, 0],
    });

    steps.push({
      id: "supply",
      label: `Supply ${symbol} to Aave`,
      description: `Depositing into Aave V3 on Base. You'll earn yield automatically.`,
      tx: {
        to: AAVE_POOL_ADDRESS,
        data: supplyData,
      },
    });

    return steps;
  },
};
