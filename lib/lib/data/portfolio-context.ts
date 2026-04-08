/**
 * Portfolio context for agent personalization.
 * Aggregates Zerion data across all user wallets (connected + watched)
 * and formats it as a text block injected into agent prompts.
 */

import { getZerionPortfolio, getZerionTokens, getZerionDeFi } from "@/lib/data/zerion";
import type { TokenBalance, DeFiPosition } from "@/lib/portfolio/fetch-portfolio";

export interface PortfolioContext {
  totalValue: number;
  change24hUsd: number;
  change24hPct: number;
  chainDistribution: Record<string, number>;
  topHoldings: {
    symbol: string;
    value: number;
    percent: number;
  }[];
  defiPositions: {
    protocol: string;
    type: string;
    value: number;
    chain: string;
  }[];
  walletCount: number;
  dataAge: number;
}

export async function fetchPortfolioContext(
  sessionAddress: string,
  watchedWallets: { address: string }[]
): Promise<PortfolioContext | null> {
  try {
    const allWallets = [
      sessionAddress,
      ...watchedWallets.map((w) => w.address),
    ];

    // Fetch summaries and tokens in parallel across all wallets
    const [portfolioResults, tokenResults, defiResults] = await Promise.all([
      Promise.allSettled(allWallets.map((a) => getZerionPortfolio(a))),
      Promise.allSettled(allWallets.map((a) => getZerionTokens(a))),
      Promise.allSettled(allWallets.map((a) => getZerionDeFi(a))),
    ]);

    let totalValue = 0;
    let change24hUsd = 0;
    const chainMap: Record<string, number> = {};

    for (const result of portfolioResults) {
      if (result.status === "fulfilled" && result.value) {
        totalValue += result.value.totalUsd;
        change24hUsd += result.value.change1dUsd;
        for (const [chain, value] of Object.entries(result.value.byChain)) {
          chainMap[chain] = (chainMap[chain] ?? 0) + value;
        }
      }
    }

    // Aggregate tokens by symbol
    const holdingsMap: Record<string, { symbol: string; value: number }> = {};
    for (const result of tokenResults) {
      if (result.status === "fulfilled") {
        for (const token of result.value) {
          if (!holdingsMap[token.symbol]) {
            holdingsMap[token.symbol] = { symbol: token.symbol, value: 0 };
          }
          holdingsMap[token.symbol].value += token.balanceUsd;
        }
      }
    }

    const topHoldings = Object.values(holdingsMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((h) => ({
        symbol: h.symbol,
        value: h.value,
        percent: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
      }));

    // Aggregate DeFi
    const defiPositions: PortfolioContext["defiPositions"] = [];
    for (const result of defiResults) {
      if (result.status === "fulfilled") {
        for (const pos of result.value) {
          defiPositions.push({
            protocol: pos.protocol,
            type: pos.type,
            value: pos.valueUsd,
            chain: pos.chain,
          });
        }
      }
    }

    // Chain distribution as percentages
    const chainDistribution: Record<string, number> = {};
    for (const [chain, value] of Object.entries(chainMap)) {
      chainDistribution[chain] = totalValue > 0 ? (value / totalValue) * 100 : 0;
    }

    return {
      totalValue,
      change24hUsd,
      change24hPct: totalValue > 0 ? (change24hUsd / totalValue) * 100 : 0,
      chainDistribution,
      topHoldings,
      defiPositions,
      walletCount: allWallets.length,
      dataAge: Date.now(),
    };
  } catch (err) {
    console.error("Portfolio context fetch failed:", (err as Error).message);
    return null;
  }
}

export function formatPortfolioContext(portfolio: PortfolioContext): string {
  const holdings = portfolio.topHoldings
    .map(
      (h) =>
        `${h.symbol} ${h.percent.toFixed(1)}% ($${h.value.toLocaleString("en-US", { maximumFractionDigits: 0 })})`
    )
    .join(" | ");

  const defi =
    portfolio.defiPositions.length > 0
      ? portfolio.defiPositions
          .map(
            (p) =>
              `${p.protocol} ${p.type} $${p.value.toLocaleString("en-US", { maximumFractionDigits: 0 })} (${p.chain})`
          )
          .join(" | ")
      : "None";

  const chains = Object.entries(portfolio.chainDistribution)
    .sort((a, b) => b[1] - a[1])
    .filter(([, pct]) => pct >= 1)
    .map(([chain, pct]) => `${chain} ${pct.toFixed(0)}%`)
    .join(" | ");

  const pnlSign = portfolio.change24hUsd >= 0 ? "+" : "";

  return `USER PORTFOLIO CONTEXT (${portfolio.walletCount} wallet${portfolio.walletCount > 1 ? "s" : ""}):
Total Value: $${portfolio.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
24h Change: ${pnlSign}$${portfolio.change24hUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} (${pnlSign}${portfolio.change24hPct.toFixed(1)}%)
Holdings: ${holdings}
DeFi: ${defi}
Chains: ${chains}`;
}
