"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/ui/DashboardLayout";
import TokenGate from "@/components/TokenGate";
import ClaudiaCharacter from "@/components/ClaudiaCharacter";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useAccount } from "wagmi";
import type { PortfolioData, TokenBalance, NFTItem, DeFiPosition, Transaction } from "@/lib/portfolio/fetch-portfolio";
import type { WatchedWallet } from "@/lib/portfolio/multiple-wallets";
import { formatChainName } from "@/lib/portfolio/fetch-portfolio";

type PortfolioTab = "overview" | "tokens" | "defi" | "nfts" | "history";

function PortfolioContent() {
  const { sessionToken } = useSessionToken();
  const { address } = useAccount();

  const [activeTab, setActiveTab] = useState<PortfolioTab>("overview");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAddress, setActiveAddress] = useState("");
  const [watchedWallets, setWatchedWallets] = useState<WatchedWallet[]>([]);
  const [addingWallet, setAddingWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [claudiaAnalysis, setClaudiaAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [portfolioContextEnabled, setPortfolioContextEnabled] = useState(false);
  const [portfolioContextLoading, setPortfolioContextLoading] = useState(true);

  useEffect(() => {
    if (address) setActiveAddress(address);
  }, [address]);

  const fetchWatchedWallets = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch("/api/portfolio/wallets", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = (await res.json()) as any;
      setWatchedWallets(data.wallets || []);
    } catch {}
  }, [sessionToken]);

  useEffect(() => {
    fetchWatchedWallets();
  }, [fetchWatchedWallets]);

  // Fetch portfolio context setting
  useEffect(() => {
    if (!sessionToken) return;
    fetch("/api/portfolio/settings", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json())
      .then((data: any) => setPortfolioContextEnabled(!!data.enabled))
      .catch(() => {})
      .finally(() => setPortfolioContextLoading(false));
  }, [sessionToken]);

  const handleTogglePortfolioContext = async (value: boolean) => {
    setPortfolioContextEnabled(value);
    if (!sessionToken) return;
    await fetch("/api/portfolio/settings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: value }),
    }).catch(() => setPortfolioContextEnabled(!value));
  };

  const loadPortfolio = useCallback(
    async (addr: string) => {
      if (!sessionToken || !addr) return;
      setLoading(true);
      setError(null);
      setClaudiaAnalysis(null);

      try {
        const [portfolioRes, historyRes] = await Promise.allSettled([
          fetch(`/api/portfolio?address=${addr}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }).then((r) => r.json()),
          fetch(`/api/portfolio/history?address=${addr}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }).then((r) => r.json()),
        ]);

        if (portfolioRes.status === "fulfilled") {
          const pData = portfolioRes.value as any;
          if (!pData.error) setPortfolio(pData);
          else setError(pData.error);
        } else {
          setError("Failed to load portfolio");
        }
        if (historyRes.status === "fulfilled") {
          const hData = historyRes.value as any;
          setPortfolioHistory(hData.history || []);
        }
      } catch {
        setError("Failed to load portfolio");
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    if (activeAddress) loadPortfolio(activeAddress);
  }, [activeAddress, loadPortfolio]);

  const handleAskClaudia = async () => {
    if (!portfolio || analyzing || !sessionToken) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ portfolio }),
      });
      const data = (await res.json()) as any;
      if (data.analysis) setClaudiaAnalysis(data.analysis);
      else if (data.error) setError(data.error);
    } catch {} finally {
      setAnalyzing(false);
    }
  };

  const addWallet = async () => {
    if (!newWalletAddress || !sessionToken) return;
    try {
      const res = await fetch("/api/portfolio/wallets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: newWalletAddress,
          label: newWalletLabel || undefined,
        }),
      });
      const data = (await res.json()) as any;
      if (data.success) {
        await fetchWatchedWallets();
        setNewWalletAddress("");
        setNewWalletLabel("");
        setAddingWallet(false);
      }
    } catch {}
  };

  const removeWallet = async (addr: string) => {
    if (!sessionToken) return;
    await fetch("/api/portfolio/wallets", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: addr }),
    }).catch(() => {});
    await fetchWatchedWallets();
    if (activeAddress.toLowerCase() === addr.toLowerCase() && address) {
      setActiveAddress(address);
    }
  };

  const TABS: { id: PortfolioTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "tokens", label: "Tokens", count: portfolio?.tokens.length },
    { id: "defi", label: "DeFi", count: portfolio?.defi.length },
    { id: "nfts", label: "NFTs", count: portfolio?.nfts.length },
    { id: "history", label: "History", count: portfolio?.transactions.length },
  ];

  return (
    <div className="px-4 py-6">
      {/* Portfolio-Aware Agents toggle */}
      {!portfolioContextLoading && (
        <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-heading font-bold text-lg">
                Portfolio-Aware Agents
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                When enabled, all agents personalize their analysis using your actual holdings and PnL.
              </p>
            </div>
            <button
              onClick={() => handleTogglePortfolioContext(!portfolioContextEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                portfolioContextEnabled ? "bg-accent" : "bg-white/10"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  portfolioContextEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {portfolioContextEnabled && (
            <p className="text-accent text-xs mt-3">
              Active — agents are using your portfolio data
            </p>
          )}
        </div>
      )}

      {/* Wallet selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {address && (
          <button
            onClick={() => setActiveAddress(address)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
              activeAddress.toLowerCase() === address.toLowerCase()
                ? "bg-accent text-white"
                : "bg-surface text-zinc-400 hover:text-white border border-white/5"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-green-400" />
            {address.slice(0, 6)}...{address.slice(-4)}
            <span className="text-xs opacity-70">connected</span>
          </button>
        )}

        {watchedWallets.map((w) => (
          <div key={w.address} className="flex items-center gap-0">
            <button
              onClick={() => setActiveAddress(w.address)}
              className={`flex items-center gap-2 px-3 py-2 rounded-l-xl text-sm transition-all ${
                activeAddress.toLowerCase() === w.address.toLowerCase()
                  ? "bg-accent text-white"
                  : "bg-surface text-zinc-400 hover:text-white border border-white/5 border-r-0"
              }`}
            >
              {w.label || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`}
            </button>
            <button
              onClick={() => removeWallet(w.address)}
              className="px-2 py-2 bg-surface border border-white/5 border-l-0 rounded-r-xl text-zinc-600 hover:text-red-400 text-xs transition-colors"
              title="Remove wallet"
            >
              &#10005;
            </button>
          </div>
        ))}

        {watchedWallets.length < 5 && (
          <button
            onClick={() => setAddingWallet(!addingWallet)}
            className="px-3 py-2 rounded-xl text-sm bg-surface border border-white/5 text-zinc-500 hover:text-white transition-all"
          >
            + Add Wallet
          </button>
        )}
      </div>

      {/* Add wallet form */}
      {addingWallet && (
        <div className="bg-surface border border-white/5 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <input
            value={newWalletAddress}
            onChange={(e) => setNewWalletAddress(e.target.value)}
            placeholder="0x... wallet address"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-zinc-600 focus:outline-none focus:border-accent/30"
          />
          <input
            value={newWalletLabel}
            onChange={(e) => setNewWalletLabel(e.target.value)}
            placeholder="Label (optional)"
            className="w-40 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-accent/30"
          />
          <button
            onClick={addWallet}
            disabled={!newWalletAddress}
            className="bg-accent hover:bg-accent/80 disabled:opacity-30 text-white text-sm px-4 py-2 rounded-xl transition-all"
          >
            Add
          </button>
          <button
            onClick={() => setAddingWallet(false)}
            className="text-zinc-500 hover:text-white text-sm px-3 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Portfolio header */}
      {loading ? (
        <div className="h-40 bg-surface rounded-2xl animate-pulse mb-6" />
      ) : portfolio ? (
        <div className="bg-surface rounded-2xl p-6 border border-white/5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-mono mb-1">
                Total Portfolio Value
              </p>
              <p className="text-white font-heading text-4xl">
                $
                {portfolio.totalValueUsd.toLocaleString("en", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p
                className={`text-sm font-mono mt-1 ${
                  portfolio.change24hPct >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {portfolio.change24hPct >= 0 ? "\u25B2" : "\u25BC"} $
                {Math.abs(portfolio.change24hUsd).toFixed(2)} (
                {Math.abs(portfolio.change24hPct).toFixed(2)}%) 24h
              </p>
            </div>
            <button
              onClick={handleAskClaudia}
              disabled={analyzing}
              className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin">&#9889;</span> Analyzing...
                </>
              ) : (
                <>&#9889; Ask CLAUDIA &middot; 2 credits</>
              )}
            </button>
          </div>

          {/* Chain badges */}
          <div className="flex gap-2 flex-wrap">
            {portfolio.chains.map((chain) => (
              <span
                key={chain}
                className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-zinc-400 font-mono"
              >
                {formatChainName(chain)}
              </span>
            ))}
            {portfolio.hasClaudia && (
              <span className="text-xs bg-accent/10 border border-accent/20 px-2 py-1 rounded-lg text-accent">
                CLAUDIA holder
              </span>
            )}
          </div>

          {/* CLAUDIA analysis */}
          {claudiaAnalysis && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-start gap-3">
                <ClaudiaCharacter
                  mood="talking"
                  size="tiny"
                  imageSrc="/claudia-avatar.png"
                />
                <p className="text-zinc-300 text-sm leading-relaxed italic">
                  &ldquo;{claudiaAnalysis}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* P&L sparkline */}
          {portfolioHistory.length > 1 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-zinc-600 text-xs font-mono mb-2">30-day value</p>
              <div className="flex items-end gap-0.5 h-10">
                {portfolioHistory.map((day: any, i: number) => {
                  const counts = portfolioHistory.map(
                    (d: any) => d.total_value_usd
                  );
                  const max = Math.max(...counts);
                  const min = Math.min(...counts);
                  const pct =
                    max === min
                      ? 50
                      : ((day.total_value_usd - min) / (max - min)) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-accent/40 hover:bg-accent/70 rounded-sm transition-colors cursor-default"
                      style={{ height: `${Math.max(pct, 8)}%` }}
                      title={`${day.snapshot_date}: $${day.total_value_usd.toFixed(0)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="bg-surface rounded-2xl p-6 border border-red-500/20 mb-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => loadPortfolio(activeAddress)}
            className="text-accent text-sm mt-2 hover:underline"
          >
            retry
          </button>
        </div>
      ) : null}

      {/* Tabs */}
      {portfolio && (
        <>
          <div className="flex gap-1 mb-6 bg-surface rounded-xl p-1 border border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-accent text-white font-medium"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id ? "bg-white/20" : "bg-white/10"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "overview" && (
            <OverviewTab portfolio={portfolio} />
          )}
          {activeTab === "tokens" && (
            <TokensTab tokens={portfolio.tokens} />
          )}
          {activeTab === "defi" && <DeFiTab defi={portfolio.defi} />}
          {activeTab === "nfts" && <NFTsTab nfts={portfolio.nfts} />}
          {activeTab === "history" && (
            <HistoryTab transactions={portfolio.transactions} />
          )}
        </>
      )}
    </div>
  );
}

// ── Tab Components ──

function OverviewTab({ portfolio }: { portfolio: PortfolioData }) {
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl p-5 border border-white/5">
        <p className="text-zinc-400 text-xs uppercase tracking-wider font-mono mb-4">
          Allocation
        </p>
        <div className="space-y-3">
          {portfolio.tokens.slice(0, 8).map((token) => {
            const pct =
              portfolio.totalValueUsd > 0
                ? (token.balanceUsd / portfolio.totalValueUsd) * 100
                : 0;
            return (
              <div key={`${token.chain}-${token.symbol}-${token.contractAddress}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {token.thumbnail && (
                      <img
                        src={token.thumbnail}
                        alt={token.symbol}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-white text-sm">{token.symbol}</span>
                    <span className="text-zinc-600 text-xs font-mono">
                      {formatChainName(token.chain)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-300 text-sm font-mono">
                      ${token.balanceUsd.toFixed(0)}
                    </span>
                    <span className="text-zinc-600 text-xs ml-2">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div
                    className="bg-accent h-1 rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl p-4 border border-white/5 text-center">
          <p className="text-white font-heading text-xl">
            {portfolio.tokens.length}
          </p>
          <p className="text-zinc-500 text-xs">tokens</p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-white/5 text-center">
          <p className="text-white font-heading text-xl">
            {portfolio.nfts.length}
          </p>
          <p className="text-zinc-500 text-xs">NFTs</p>
        </div>
        <div className="bg-surface rounded-xl p-4 border border-white/5 text-center">
          <p className="text-white font-heading text-xl">
            {portfolio.chains.length}
          </p>
          <p className="text-zinc-500 text-xs">chains</p>
        </div>
      </div>
    </div>
  );
}

function TokensTab({ tokens }: { tokens: TokenBalance[] }) {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-white/5">
      {tokens.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-500 text-sm">no tokens found</p>
        </div>
      ) : (
        tokens.map((token) => (
          <div
            key={`${token.chain}-${token.symbol}-${token.contractAddress}`}
            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
          >
            {token.thumbnail ? (
              <img
                src={token.thumbnail}
                alt={token.symbol}
                className="w-8 h-8 rounded-full flex-shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs text-zinc-400">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-medium">{token.symbol}</p>
                <span className="text-xs text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                  {formatChainName(token.chain)}
                </span>
                {token.isNative && (
                  <span className="text-[9px] text-zinc-600">native</span>
                )}
              </div>
              <p className="text-zinc-600 text-xs font-mono truncate">
                {parseFloat(token.balance).toLocaleString()} {token.symbol}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white text-sm font-mono">
                ${token.balanceUsd.toFixed(2)}
              </p>
              <p className="text-zinc-600 text-xs font-mono">
                ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(4)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DeFiTab({ defi }: { defi: DeFiPosition[] }) {
  if (defi.length === 0) {
    return (
      <div className="bg-surface rounded-2xl py-16 text-center border border-white/5">
        <ClaudiaCharacter
          mood="skeptical"
          size="small"
          imageSrc="/claudia-avatar.png"
        />
        <p className="text-zinc-500 text-sm mt-4">no positions found.</p>
        <Link
          href="/defi"
          className="text-accent text-sm mt-1 block hover:underline"
        >
          find yield pools &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {defi.map((pos, i) => (
        <div
          key={i}
          className="bg-surface rounded-xl p-4 border border-white/5 flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white text-sm font-medium">{pos.protocol}</p>
              <span
                className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                  pos.type === "lp"
                    ? "bg-blue-500/10 text-blue-400"
                    : pos.type === "staking"
                    ? "bg-purple-500/10 text-purple-400"
                    : pos.type === "lending"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-white/5 text-zinc-400"
                }`}
              >
                {pos.type}
              </span>
              <span className="text-zinc-600 text-xs font-mono">
                {formatChainName(pos.chain)}
              </span>
            </div>
            {pos.tokenA && (
              <p className="text-zinc-500 text-xs">
                {pos.tokenA}
                {pos.tokenB ? ` / ${pos.tokenB}` : ""}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-white text-sm font-mono">
              ${pos.valueUsd.toFixed(2)}
            </p>
            {pos.apr != null && (
              <p className="text-green-400 text-xs font-mono">
                {pos.apr.toFixed(1)}% APR
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NFTsTab({ nfts }: { nfts: NFTItem[] }) {
  if (nfts.length === 0) {
    return (
      <div className="bg-surface rounded-2xl py-16 text-center border border-white/5">
        <p className="text-zinc-500 text-sm">no NFTs found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {nfts.map((nft, i) => (
        <div
          key={`${nft.contractAddress}-${nft.tokenId}-${i}`}
          className="bg-surface rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all"
        >
          {nft.imageUrl ? (
            <img
              src={nft.imageUrl}
              alt={nft.name}
              className="w-full aspect-square object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
              <span className="text-zinc-600 text-2xl">&#x1F5BC;</span>
            </div>
          )}
          <div className="p-2">
            <p className="text-white text-xs font-medium truncate">
              {nft.name}
            </p>
            <p className="text-zinc-600 text-xs truncate">{nft.collection}</p>
            <p className="text-zinc-600 text-[10px] font-mono">
              {formatChainName(nft.chain)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-surface rounded-2xl py-16 text-center border border-white/5">
        <p className="text-zinc-500 text-sm">no recent transactions</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-white/5">
      {transactions.map((tx) => (
        <a
          key={tx.hash}
          href={`https://${tx.chain === "eth" ? "etherscan.io" : "basescan.org"}/tx/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
              tx.type === "receive"
                ? "bg-green-500/10 text-green-400"
                : tx.type === "send"
                ? "bg-red-500/10 text-red-400"
                : "bg-blue-500/10 text-blue-400"
            }`}
          >
            {tx.type === "receive"
              ? "\u2193"
              : tx.type === "send"
              ? "\u2191"
              : "\u21C4"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{tx.description}</p>
            <p className="text-zinc-600 text-xs font-mono">
              {new Date(tx.timestamp).toLocaleDateString()} &middot;{" "}
              {formatChainName(tx.chain)}
            </p>
          </div>
          {tx.valueUsd != null && tx.valueUsd > 0.01 && (
            <p
              className={`text-sm font-mono flex-shrink-0 ${
                tx.type === "receive" ? "text-green-400" : "text-zinc-300"
              }`}
            >
              ${tx.valueUsd.toFixed(2)}
            </p>
          )}
        </a>
      ))}
    </div>
  );
}

// ── Page wrapper ──

export default function PortfolioPage() {
  return (
    <DashboardLayout>
      <TokenGate featureName="Portfolio Tracker">
        <PortfolioContent />
      </TokenGate>
    </DashboardLayout>
  );
}
