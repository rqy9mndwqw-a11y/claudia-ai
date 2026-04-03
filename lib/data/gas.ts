/**
 * Base chain gas price data via public RPC.
 * No API key needed.
 */

const BASE_RPC = "https://mainnet.base.org";

export type GasData = {
  baseFeeGwei: number;
  fastGwei: number;
  standardGwei: number;
  slowGwei: number;
  recommendation: string;
  standardCostUsd: number;
  fetchedAt: number;
};

export async function getBaseGasPrice(): Promise<GasData | null> {
  try {
    const [feeRes, historyRes] = await Promise.allSettled([
      fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
        cf: { cacheTtl: 30, cacheEverything: true },
      } as any),
      fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_feeHistory", params: ["0x5", "latest", [10, 50, 90]], id: 2 }),
        cf: { cacheTtl: 30, cacheEverything: true },
      } as any),
    ]);

    if (feeRes.status !== "fulfilled" || !feeRes.value.ok) return null;
    const feeData = (await feeRes.value.json()) as any;
    const gasPriceWei = parseInt(feeData.result, 16);
    const gasPriceGwei = gasPriceWei / 1e9;

    let slowGwei = gasPriceGwei * 0.8;
    let standardGwei = gasPriceGwei;
    let fastGwei = gasPriceGwei * 1.2;

    if (historyRes.status === "fulfilled" && historyRes.value.ok) {
      const feeHistory = (await historyRes.value.json()) as any;
      const rewards = feeHistory.result?.reward || [];
      if (rewards.length > 0) {
        const last = rewards[rewards.length - 1];
        slowGwei = parseInt(last[0], 16) / 1e9 + gasPriceGwei;
        standardGwei = parseInt(last[1], 16) / 1e9 + gasPriceGwei;
        fastGwei = parseInt(last[2], 16) / 1e9 + gasPriceGwei;
      }
    }

    const gasLimitTransfer = 21000;
    const standardCostEth = (standardGwei * gasLimitTransfer) / 1e9;
    const recommendation = gasPriceGwei < 0.01 ? "low" : gasPriceGwei < 0.1 ? "medium" : "high";

    return {
      baseFeeGwei: Math.round(gasPriceGwei * 10000) / 10000,
      fastGwei: Math.round(fastGwei * 10000) / 10000,
      standardGwei: Math.round(standardGwei * 10000) / 10000,
      slowGwei: Math.round(slowGwei * 10000) / 10000,
      recommendation,
      standardCostUsd: standardCostEth * 3000,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function formatGasContext(gas: GasData | null): string {
  if (!gas) return "";

  return [
    "BASE CHAIN GAS PRICES (live):",
    `Current base fee: ${gas.baseFeeGwei.toFixed(4)} gwei`,
    `Fast: ${gas.fastGwei.toFixed(4)} gwei`,
    `Standard: ${gas.standardGwei.toFixed(4)} gwei`,
    `Slow: ${gas.slowGwei.toFixed(4)} gwei`,
    `Conditions: ${gas.recommendation.toUpperCase()}`,
    `Standard transfer cost: ~$${gas.standardCostUsd.toFixed(4)}`,
    `Note: Base L2 fees are typically sub-cent — timing matters less than on L1`,
  ].join("\n");
}
