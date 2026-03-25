import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { ERC20_ABI, AERODROME_GAUGE_ABI } from "../contracts";
import type { Position, ProtocolAdapter } from "./types";

const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
];

function getClient() {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URLS[0]),
  });
}

/**
 * Popular Aerodrome gauges on Base.
 * Gauge = where you stake LP tokens for AERO rewards.
 * We check both LP token balance and gauge staked balance.
 */
const POPULAR_GAUGES: Array<{
  name: string;
  symbol: string;
  lpToken: `0x${string}`;
  gauge: `0x${string}`;
  stable: boolean;
}> = [
  {
    name: "USDC/AERO",
    symbol: "vAMM-USDC/AERO",
    lpToken: "0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d" as `0x${string}`,
    gauge: "0x4F09bAb2f0Ec4A6d0f44ADc30B1C345fcAb8e848" as `0x${string}`,
    stable: false,
  },
  {
    name: "WETH/USDC",
    symbol: "vAMM-WETH/USDC",
    lpToken: "0xB4885Bc63399BF5518b994c1d0C153334Ee579D0" as `0x${string}`,
    gauge: "0xeca7Ff920E7162334634c721133F3183B83B0323" as `0x${string}`,
    stable: false,
  },
  {
    name: "USDC/USDbC",
    symbol: "sAMM-USDC/USDbC",
    lpToken: "0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD" as `0x${string}`,
    gauge: "0xD13532De529E5555E28E2332354f63D9715C8925" as `0x${string}`,
    stable: true,
  },
  {
    name: "WETH/cbETH",
    symbol: "vAMM-WETH/cbETH",
    lpToken: "0x44Ecc644449fC3a9858d2007CaA8CFAa4C561f91" as `0x${string}`,
    gauge: "0xF5550F8F0331B8CAA165046667f4E6628E9E3Aac" as `0x${string}`,
    stable: false,
  },
];

/**
 * Aerodrome adapter for Base.
 * Checks popular gauge contracts for staked LP positions + pending AERO rewards.
 */
export const aerodromeAdapter: ProtocolAdapter = {
  protocol: "Aerodrome",

  async getPositions(address: `0x${string}`): Promise<Position[]> {
    const client = getClient();
    const positions: Position[] = [];

    // Check all popular gauges in parallel
    const results = await Promise.allSettled(
      POPULAR_GAUGES.flatMap((g) => [
        // Staked balance in gauge
        client.readContract({
          address: g.gauge,
          abi: AERODROME_GAUGE_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        // Pending AERO rewards
        client.readContract({
          address: g.gauge,
          abi: AERODROME_GAUGE_ABI,
          functionName: "earned",
          args: [address],
        }),
        // Unstaked LP tokens in wallet
        client.readContract({
          address: g.lpToken,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
      ])
    );

    for (let i = 0; i < POPULAR_GAUGES.length; i++) {
      const gauge = POPULAR_GAUGES[i];
      const stakedResult = results[i * 3];
      const earnedResult = results[i * 3 + 1];
      const unstakedResult = results[i * 3 + 2];

      const stakedBal = stakedResult.status === "fulfilled" ? (stakedResult.value as bigint) : 0n;
      const earnedBal = earnedResult.status === "fulfilled" ? (earnedResult.value as bigint) : 0n;
      const unstakedBal = unstakedResult.status === "fulfilled" ? (unstakedResult.value as bigint) : 0n;

      const totalLp = stakedBal + unstakedBal;
      if (totalLp === 0n && earnedBal === 0n) continue;

      // LP tokens are 18 decimals
      const balance = formatUnits(totalLp, 18);
      const earned = formatUnits(earnedBal, 18);

      // We can't easily price LP tokens without reading reserves.
      // For now, report the raw LP amount — the portfolio page shows it as a position.
      // A proper implementation would read pool reserves and compute USD value.
      positions.push({
        protocol: "Aerodrome",
        pool: `${gauge.name} (${gauge.stable ? "stable" : "volatile"} LP)`,
        tokens: gauge.name.split("/"),
        currentValue: 0, // TODO: compute from reserves
        apy: null,
        chain: "Base",
        balance: `${balance} LP${parseFloat(earned) > 0 ? ` + ${parseFloat(earned).toFixed(4)} AERO` : ""}`,
        tokenAddress: gauge.gauge,
      });
    }

    return positions;
  },
};
