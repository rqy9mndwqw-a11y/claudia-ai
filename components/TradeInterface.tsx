"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import ClaudiaAvatar from "./ClaudiaAvatar";
import { SUPPORTED_PAIRS } from "@/lib/kraken-pairs";

type Step = "setup" | "watchlist" | "scanning" | "signals" | "executing" | "done";
type AvatarState = "idle" | "thinking" | "responding" | "sideeye" | "smug";

interface TradeSignal {
  symbol: string;
  price: number;
  change24h: number;
  rsi: number;
  volume24h: number;
}

export default function TradeInterface() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("setup");
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");

  // Exchange + API key state
  const [exchange, setExchange] = useState<"kraken" | "coinbase">("kraken");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [keyVerified, setKeyVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [keyError, setKeyError] = useState("");

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Signals
  const [analysis, setAnalysis] = useState("");
  const [signalData, setSignalData] = useState<TradeSignal[]>([]);
  const [scanError, setScanError] = useState("");

  // Execution
  const [execSymbol, setExecSymbol] = useState("");
  const [execSide, setExecSide] = useState<"buy" | "sell">("buy");
  const [execAmount, setExecAmount] = useState("");
  const [execStopLoss, setExecStopLoss] = useState("");
  const [execTakeProfit, setExecTakeProfit] = useState("");
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null);
  const [executing, setExecuting] = useState(false);

  // Load saved keys from localStorage
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`claudia_keys_${address.slice(0, 10)}`);
      if (saved) {
        try {
          const parsed = JSON.parse(atob(saved));
          setApiKey(parsed.k || "");
          setApiSecret(parsed.s || "");
          setExchange(parsed.e || "kraken");
          setKeyVerified(true);
          setStep("watchlist");
        } catch { /* corrupt data, ignore */ }
      }
    }
  }, [address]);

  const saveKeys = () => {
    if (address) {
      const encoded = btoa(JSON.stringify({ k: apiKey, s: apiSecret, e: exchange }));
      localStorage.setItem(`claudia_keys_${address.slice(0, 10)}`, encoded);
    }
  };

  const clearKeys = () => {
    if (address) {
      localStorage.removeItem(`claudia_keys_${address.slice(0, 10)}`);
    }
    setApiKey("");
    setApiSecret("");
    setKeyVerified(false);
    setBalances({});
    setStep("setup");
  };

  const handleVerifyKey = async () => {
    setVerifying(true);
    setKeyError("");
    setAvatarState("thinking");

    try {
      const res = await fetch("/api/trade/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, exchange }),
      });
      const data = await res.json();

      if (data.valid) {
        setKeyVerified(true);
        setBalances(data.balances);
        saveKeys();
        setStep("watchlist");
        setAvatarState("smug");
      } else {
        setKeyError(data.error || "Invalid credentials");
        setAvatarState("sideeye");
      }
    } catch {
      setKeyError("Verification failed");
      setAvatarState("sideeye");
    } finally {
      setVerifying(false);
    }
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : prev.length < 5
        ? [...prev, symbol]
        : prev
    );
  };

  const handleScan = async () => {
    if (watchlist.length === 0) return;
    setStep("scanning");
    setAvatarState("thinking");
    setScanError("");

    try {
      const res = await fetch("/api/trade/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist, address, exchange }),
      });

      const data = await res.json();
      if (data.error) {
        setScanError(data.error);
        setStep("watchlist");
        setAvatarState("sideeye");
        return;
      }

      setAnalysis(data.analysis);
      setSignalData(data.data || []);
      setStep("signals");
      setAvatarState("smug");
    } catch {
      setScanError("Scan failed. Try again.");
      setStep("watchlist");
      setAvatarState("sideeye");
    }
  };

  const handleExecute = async () => {
    if (!execSymbol || !execAmount || !execSide) return;
    setExecuting(true);
    setExecResult(null);
    setAvatarState("thinking");

    try {
      const sl = execStopLoss ? parseFloat(execStopLoss) : undefined;
      const tp = execTakeProfit ? parseFloat(execTakeProfit) : undefined;

      const res = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          apiKey,
          apiSecret,
          exchange,
          symbol: execSymbol,
          side: execSide,
          amount: parseFloat(execAmount),
          orderType: "market",
          stopLoss: sl,
          takeProfit: tp,
        }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Order placed: ${data.description}`;
        if (data.closeDescription) msg += `\n${data.closeDescription}`;
        msg += ` (ID: ${data.orderId})`;
        setExecResult({ success: true, message: msg });
        setAvatarState("smug");
      } else {
        setExecResult({ success: false, message: data.error || "Trade failed" });
        setAvatarState("sideeye");
      }
    } catch {
      setExecResult({ success: false, message: "Execution failed" });
      setAvatarState("sideeye");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Avatar panel */}
      <div className="hidden md:flex flex-col items-center justify-start w-48 border-r border-white/5 bg-surface/30 pt-6">
        <ClaudiaAvatar state={avatarState} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl mx-auto">

          {/* Step 1: API Key Setup */}
          {step === "setup" && (
            <div className="animate-fade-in">
              <h2 className="font-heading text-2xl font-bold text-white mb-2">
                Connect Your Exchange
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                Create an API key with <span className="text-white">Trade + Query</span> permissions.{" "}
                <span className="text-accent">Never enable withdrawals.</span>
              </p>

              <div className="space-y-4">
                {/* Exchange picker */}
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-widest mb-2 block">Exchange</label>
                  <div className="flex gap-2">
                    {(["kraken", "coinbase"] as const).map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setExchange(ex)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                          exchange === ex
                            ? "bg-accent/20 text-white border border-accent"
                            : "bg-surface text-zinc-500 border border-white/5 hover:border-accent/30 hover:text-white"
                        }`}
                      >
                        {ex === "kraken" ? "Kraken" : "Coinbase"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-widest mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Your ${exchange === "kraken" ? "Kraken" : "Coinbase"} API key`}
                    className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3
                               text-white text-sm font-mono outline-none focus:border-accent/30"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs uppercase tracking-widest mb-1 block">API Secret</label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder={`Your ${exchange === "kraken" ? "Kraken" : "Coinbase"} API secret`}
                    className="w-full bg-surface border border-white/10 rounded-lg px-4 py-3
                               text-white text-sm font-mono outline-none focus:border-accent/30"
                  />
                </div>

                {keyError && (
                  <p className="text-red-400 text-sm">{keyError}</p>
                )}

                <button
                  onClick={handleVerifyKey}
                  disabled={!apiKey || !apiSecret || verifying}
                  className="bg-accent hover:bg-accent/80 disabled:opacity-30
                             text-white font-heading font-bold px-6 py-3 rounded-xl
                             transition-all w-full"
                >
                  {verifying ? "Verifying..." : `Connect ${exchange === "kraken" ? "Kraken" : "Coinbase"}`}
                </button>

                <div className="bg-surface/50 rounded-lg p-3 border border-white/5">
                  <p className="text-zinc-600 text-[10px] leading-relaxed">
                    Your keys are stored encrypted in your browser only. They&apos;re sent over HTTPS
                    when scanning or trading, then discarded. Never stored on our servers.
                    Claudia can&apos;t withdraw — only trade. Revoke your key anytime from {exchange === "kraken" ? "Kraken" : "Coinbase"} settings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Watchlist */}
          {step === "watchlist" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-white mb-1">
                    Pick Your Watchlist
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    Select up to 5 coins. Claudia will scan them for signals.
                  </p>
                </div>
                <button
                  onClick={clearKeys}
                  className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* Balance display */}
              {Object.keys(balances).length > 0 && (
                <div className="bg-surface rounded-lg p-3 border border-white/5 mb-4">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Your Balances</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(balances).slice(0, 8).map(([k, v]) => (
                      <span key={k} className="text-xs text-zinc-400 bg-surface-light px-2 py-1 rounded">
                        {k}: {v.toFixed(4)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 md:grid-cols-5 gap-2 mb-6">
                {SUPPORTED_PAIRS.map((symbol) => (
                  <button
                    key={symbol}
                    onClick={() => toggleWatchlist(symbol)}
                    className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                      watchlist.includes(symbol)
                        ? "bg-accent text-white border border-accent"
                        : "bg-surface text-zinc-500 border border-white/5 hover:border-accent/30 hover:text-white"
                    }`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>

              <p className="text-zinc-600 text-xs mb-4">
                {watchlist.length}/5 selected{watchlist.length > 0 && `: ${watchlist.join(", ")}`}
              </p>

              {scanError && <p className="text-red-400 text-sm mb-4">{scanError}</p>}

              <button
                onClick={handleScan}
                disabled={watchlist.length === 0}
                className="bg-accent hover:bg-accent/80 disabled:opacity-30
                           text-white font-heading font-bold px-6 py-3 rounded-xl
                           transition-all w-full"
              >
                Scan Watchlist
              </button>
            </div>
          )}

          {/* Scanning */}
          {step === "scanning" && (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent mb-4" />
              <p className="text-zinc-400 font-heading">Claudia is scanning {watchlist.join(", ")}...</p>
              <p className="text-zinc-600 text-xs mt-2">Analyzing price action, RSI, moving averages, volume</p>
            </div>
          )}

          {/* Signals */}
          {step === "signals" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-2xl font-bold text-white">
                  Claudia&apos;s Verdict
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStep("watchlist"); setAnalysis(""); }}
                    className="text-zinc-500 text-xs hover:text-white bg-surface px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleScan}
                    className="text-accent text-xs hover:text-white bg-accent/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Rescan
                  </button>
                </div>
              </div>

              {/* Price ticker strip */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                {signalData.map((d) => (
                  <div
                    key={d.symbol}
                    onClick={() => setExecSymbol(d.symbol)}
                    className={`flex-shrink-0 bg-surface rounded-lg px-4 py-3 border cursor-pointer transition-all ${
                      execSymbol === d.symbol ? "border-accent" : "border-white/5 hover:border-accent/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white">{d.symbol}</span>
                      <span className="text-white font-bold">${d.price.toLocaleString()}</span>
                      <span className={`text-xs font-mono ${d.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {d.change24h >= 0 ? "+" : ""}{d.change24h}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-mono ${
                        d.rsi > 70 ? "text-red-400" : d.rsi < 30 ? "text-green-400" : "text-zinc-500"
                      }`}>
                        RSI {d.rsi}
                      </span>
                      <span className="text-zinc-600 text-[10px]">
                        Vol ${d.volume24h >= 1_000_000 ? `${(d.volume24h / 1_000_000).toFixed(1)}M` : `${(d.volume24h / 1_000).toFixed(0)}K`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Analysis */}
              <div className="bg-surface rounded-xl p-6 border border-white/5 mb-6">
                <div className="prose prose-invert prose-sm max-w-none
                                prose-h3:text-accent prose-h3:font-heading prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1
                                prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5
                                prose-strong:text-white prose-em:text-zinc-400 prose-code:text-coral">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                    {analysis}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Execute section */}
              <div className="bg-surface-light rounded-xl p-5 border border-accent/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-white">Execute Trade</h3>
                  {Object.keys(balances).length > 0 && (
                    <span className="text-zinc-500 text-xs">
                      Available: <span className="text-white font-mono">
                        ${balances["ZUSD"]?.toFixed(2) || balances["USD"]?.toFixed(2) || "0.00"} USD
                      </span>
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Row 1: Coin, Side, Amount */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-zinc-600 text-[10px] uppercase tracking-widest block mb-1">Coin</label>
                      <select
                        value={execSymbol}
                        onChange={(e) => setExecSymbol(e.target.value)}
                        className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5
                                   text-white text-sm outline-none focus:border-accent/30"
                      >
                        <option value="">Select</option>
                        {watchlist.map((s) => {
                          const d = signalData.find((x) => x.symbol === s);
                          return (
                            <option key={s} value={s}>
                              {s} — ${d?.price.toLocaleString() || "?"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-600 text-[10px] uppercase tracking-widest block mb-1">Side</label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setExecSide("buy")}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                            execSide === "buy"
                              ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                              : "bg-surface text-zinc-500 hover:text-white"
                          }`}
                        >BUY</button>
                        <button
                          onClick={() => setExecSide("sell")}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                            execSide === "sell"
                              ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                              : "bg-surface text-zinc-500 hover:text-white"
                          }`}
                        >SELL</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-600 text-[10px] uppercase tracking-widest block mb-1">
                        Amount (USD)
                        {balances["ZUSD"] && (
                          <button
                            onClick={() => setExecAmount(String(Math.floor(balances["ZUSD"] || 0)))}
                            className="text-accent ml-2 hover:text-white"
                          >
                            MAX
                          </button>
                        )}
                      </label>
                      <input
                        type="number"
                        value={execAmount}
                        onChange={(e) => setExecAmount(e.target.value)}
                        placeholder="100"
                        className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2.5
                                   text-white text-sm font-mono outline-none focus:border-accent/30"
                      />
                    </div>
                  </div>

                  {/* Row 2: Stop Loss + Take Profit (optional) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-600 text-[10px] uppercase tracking-widest block mb-1">
                        Stop Loss
                        <span className="text-zinc-700 normal-case ml-1">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">$</span>
                        <input
                          type="number"
                          value={execStopLoss}
                          onChange={(e) => setExecStopLoss(e.target.value)}
                          placeholder="0.00"
                          step="any"
                          className="w-full bg-surface border border-white/10 rounded-lg pl-7 pr-3 py-2.5
                                     text-red-400 text-sm font-mono outline-none focus:border-red-500/30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-zinc-600 text-[10px] uppercase tracking-widest block mb-1">
                        Take Profit
                        <span className="text-zinc-700 normal-case ml-1">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">$</span>
                        <input
                          type="number"
                          value={execTakeProfit}
                          onChange={(e) => setExecTakeProfit(e.target.value)}
                          placeholder="0.00"
                          step="any"
                          className="w-full bg-surface border border-white/10 rounded-lg pl-7 pr-3 py-2.5
                                     text-green-400 text-sm font-mono outline-none focus:border-green-500/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Claudia's suggested levels hint */}
                  {execSymbol && analysis && (
                    <p className="text-zinc-600 text-[10px] italic">
                      Check Claudia&apos;s signal above for suggested stop and target levels on {execSymbol}.
                    </p>
                  )}

                  {/* Order preview */}
                  {execSymbol && execAmount && (
                    <div className="bg-surface rounded-lg px-4 py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Market {execSide.toUpperCase()} ~${parseFloat(execAmount || "0").toLocaleString()} of {execSymbol}</span>
                        {signalData.find((d) => d.symbol === execSymbol) && (
                          <span className="text-zinc-600">
                            ≈ {(parseFloat(execAmount || "0") / (signalData.find((d) => d.symbol === execSymbol)?.price || 1)).toFixed(6)} {execSymbol}
                          </span>
                        )}
                      </div>
                      {(execStopLoss || execTakeProfit) && (
                        <div className="flex items-center gap-4 text-[10px]">
                          {execStopLoss && (
                            <span className="text-red-400">SL: ${parseFloat(execStopLoss).toLocaleString()}</span>
                          )}
                          {execTakeProfit && (
                            <span className="text-green-400">TP: ${parseFloat(execTakeProfit).toLocaleString()}</span>
                          )}
                          {execStopLoss && execTakeProfit && signalData.find((d) => d.symbol === execSymbol) && (
                            <span className="text-zinc-600">
                              R:R {((parseFloat(execTakeProfit) - (signalData.find((d) => d.symbol === execSymbol)?.price || 0)) / ((signalData.find((d) => d.symbol === execSymbol)?.price || 0) - parseFloat(execStopLoss))).toFixed(1)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleExecute}
                    disabled={!execSymbol || !execAmount || executing || parseFloat(execAmount || "0") <= 0}
                    className={`w-full font-heading font-bold py-3 rounded-xl text-sm transition-all ${
                      execSide === "buy"
                        ? "bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white"
                        : "bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white"
                    }`}
                  >
                    {executing
                      ? "Placing Order..."
                      : execSymbol
                      ? `${execSide.toUpperCase()} ${execSymbol}${execStopLoss || execTakeProfit ? " + SL/TP" : ""}`
                      : "Select a coin above"}
                  </button>

                  {execResult && (
                    <div className={`rounded-lg px-4 py-3 text-sm whitespace-pre-line ${
                      execResult.success
                        ? "bg-green-900/20 text-green-400 border border-green-800/30"
                        : "bg-red-900/20 text-red-400 border border-red-800/30"
                    }`}>
                      {execResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
