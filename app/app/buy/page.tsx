"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, encodeFunctionData } from "viem";
import DashboardLayout from "@/components/ui/DashboardLayout";

/**
 * Buy $CLAUDIA — native swap via Aerodrome Router on Base.
 * No iframe, no external redirect. User swaps ETH→CLAUDIA in-app.
 */

const CLAUDIA_CONTRACT = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as const;
const POOL_ADDRESS = "0xe6be7cc04136ddada378175311fbd6424409f997" as const;
const AERODROME_FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as const;

// Aerodrome Router V2 ABI (only the functions we need)
const ROUTER_ABI = [
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

const ROUTE = [
  {
    from: WETH,
    to: CLAUDIA_CONTRACT,
    stable: false,
    factory: AERODROME_FACTORY,
  },
];

const PRESET_AMOUNTS = ["0.001", "0.005", "0.01", "0.05"];

export default function BuyPage() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });

  const [ethAmount, setEthAmount] = useState("0.01");
  const [estimatedClaudia, setEstimatedClaudia] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const { sendTransaction, data: txHash, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get quote from Aerodrome Router
  const getQuote = useCallback(async () => {
    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      setEstimatedClaudia(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const amountIn = parseEther(ethAmount);
      const calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountIn, ROUTE],
      });

      const res = await fetch("https://mainnet.base.org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: AERODROME_ROUTER, data: calldata }, "latest"],
          id: 1,
        }),
      });

      const data = (await res.json()) as any;
      if (data.error) {
        setQuoteError("Could not get quote — pool may have low liquidity");
        setEstimatedClaudia(null);
        return;
      }

      // Decode amounts — last element is output amount
      // ABI returns uint256[] — the hex result contains offset + length + values
      const hex = data.result as string;
      // Skip function selector offset (64 chars for offset, 64 for array length)
      // Then each uint256 is 64 hex chars
      const stripped = hex.slice(2); // remove 0x
      const chunks = stripped.match(/.{64}/g) || [];
      // chunks[0] = offset, chunks[1] = array length, chunks[2] = amountIn, chunks[3] = amountOut
      if (chunks.length >= 4) {
        const amountOutHex = chunks[3];
        const amountOut = BigInt("0x" + amountOutHex);
        // CLAUDIA has 18 decimals
        const formatted = formatEther(amountOut);
        setEstimatedClaudia(parseFloat(formatted).toLocaleString(undefined, { maximumFractionDigits: 0 }));
      } else {
        setQuoteError("Unexpected quote response");
        setEstimatedClaudia(null);
      }
    } catch {
      setQuoteError("Quote failed — try again");
      setEstimatedClaudia(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [ethAmount]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(getQuote, 500);
    return () => clearTimeout(timer);
  }, [getQuote]);

  // Execute swap
  const handleSwap = () => {
    if (!address || !ethAmount || parseFloat(ethAmount) <= 0) return;
    setSwapError(null);

    try {
      const amountIn = parseEther(ethAmount);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 min
      // 5% slippage — for low-liquidity tokens this is necessary
      const amountOutMin = BigInt(0);

      const calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: "swapExactETHForTokens",
        args: [amountOutMin, ROUTE, address, deadline],
      });

      sendTransaction({
        to: AERODROME_ROUTER,
        data: calldata,
        value: amountIn,
      });
    } catch (err) {
      setSwapError((err as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-white font-heading text-2xl mb-1">Buy $CLAUDIA</h1>
            <p className="text-zinc-500 text-sm">swap ETH for $CLAUDIA directly on Base</p>
          </div>

          {/* Swap card */}
          <div className="bg-surface border border-white/5 rounded-2xl p-5 mb-4">
            {/* You pay */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-500 text-xs font-mono uppercase">You pay</p>
                {ethBalance && (
                  <p className="text-zinc-600 text-xs font-mono">
                    Balance: {parseFloat(formatEther(ethBalance.value)).toFixed(4)} ETH
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 bg-bg border border-white/10 rounded-xl p-3">
                <input
                  type="number"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.001"
                  min="0"
                  className="flex-1 bg-transparent text-white text-xl font-mono outline-none placeholder-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">E</div>
                  <span className="text-white text-sm font-medium">ETH</span>
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2 mt-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setEthAmount(amt)}
                    className={`flex-1 text-[10px] font-mono py-1.5 rounded-lg border transition-all ${
                      ethAmount === amt
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10"
                    }`}
                  >
                    {amt} ETH
                  </button>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-2">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
                &#8595;
              </div>
            </div>

            {/* You receive */}
            <div className="mb-4">
              <p className="text-zinc-500 text-xs font-mono uppercase mb-2">You receive (estimated)</p>
              <div className="flex items-center gap-3 bg-bg border border-white/10 rounded-xl p-3">
                <div className="flex-1">
                  {quoteLoading ? (
                    <div className="h-7 w-32 bg-white/5 rounded animate-pulse" />
                  ) : estimatedClaudia ? (
                    <p className="text-white text-xl font-mono">{estimatedClaudia}</p>
                  ) : quoteError ? (
                    <p className="text-red-400 text-sm">{quoteError}</p>
                  ) : (
                    <p className="text-zinc-700 text-xl font-mono">0</p>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-accent/10 px-3 py-1.5 rounded-lg flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white">C</div>
                  <span className="text-accent text-sm font-medium">CLAUDIA</span>
                </div>
              </div>
            </div>

            {/* Swap info */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-4 space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-600">Route</span>
                <span className="text-zinc-400">ETH &rarr; WETH &rarr; CLAUDIA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">DEX</span>
                <span className="text-zinc-400">Aerodrome V2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Slippage</span>
                <span className="text-zinc-400">auto (low liquidity)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Tax</span>
                <span className="text-zinc-400">2% on DEX trades</span>
              </div>
            </div>

            {/* Swap button */}
            {!isConnected ? (
              <p className="text-center text-zinc-500 text-sm py-3">
                Connect wallet to swap
              </p>
            ) : isSuccess ? (
              <div className="text-center py-3">
                <p className="text-green-400 text-sm font-medium mb-2">Swap successful!</p>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent text-xs hover:underline"
                >
                  View on BaseScan &rarr;
                </a>
              </div>
            ) : (
              <button
                onClick={handleSwap}
                disabled={isSending || isConfirming || !estimatedClaudia || parseFloat(ethAmount) <= 0}
                className="w-full bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-heading font-bold py-4 rounded-xl transition-all animate-glow-green"
              >
                {isSending ? (
                  "Confirm in wallet..."
                ) : isConfirming ? (
                  "Swapping..."
                ) : (
                  "Swap for $CLAUDIA"
                )}
              </button>
            )}

            {swapError && (
              <p className="text-red-400 text-xs mt-2 text-center">{swapError}</p>
            )}
          </div>

          {/* Token info */}
          <div className="bg-surface border border-white/5 rounded-2xl p-4">
            <p className="text-zinc-400 text-xs uppercase tracking-wider font-mono mb-3">
              Token Details
            </p>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Contract</span>
                <a
                  href={`https://basescan.org/token/${CLAUDIA_CONTRACT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {CLAUDIA_CONTRACT.slice(0, 6)}...{CLAUDIA_CONTRACT.slice(-4)}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Chain</span>
                <span className="text-zinc-300">Base</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">DEX</span>
                <span className="text-zinc-300">Aerodrome V2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Pool</span>
                <a
                  href={`https://basescan.org/address/${POOL_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  WETH/CLAUDIA
                </a>
              </div>
            </div>
          </div>

          <p className="text-zinc-700 text-[10px] text-center mt-4 font-mono">
            not financial advice. obviously.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
