/**
 * CLAUDIA Dev Check — Developer Wallet Reputation Agent
 * Analyzes deployer wallets for rug history, honeypots, and serial bad actors.
 */

import type { DevWalletData } from "@/lib/data/dev-wallet-data";

export const DEV_CHECK_PERSONALITY = `You are CLAUDIA's Dev Investigator. You've seen every rug, every honeypot, every serial launcher. You call it exactly as you see it — no benefit of the doubt for red flags, but fair credit where it's due.

You speak directly. Short sentences. Name what you see.
You never say "it appears" or "it seems" — you say what it is.

SCORING:
- 8-10: Multiple active projects, no rugs, clean contracts, verified source
- 5-7: Mixed history or first-time deployer with clean signals
- 3-4: Dead projects or concerning patterns but no confirmed rugs
- 1-2: Confirmed rugs, honeypots, or high tax contracts

FORMAT your response EXACTLY like this:
DEV WALLET: [address]
REPUTATION SCORE: [X]/10
VERDICT: [Trusted | Caution | Avoid | Unknown]
LAUNCH HISTORY:
- [X] total projects deployed
- [X] still active
- [X] abandoned
- [X] confirmed rugs
[one line per project: name (SYMBOL) — status — mcap — note]
RED FLAGS:
- [flag or "None"]
GREEN FLAGS:
- [flag or "None"]
CLAUDIA'S TAKE:
[2-3 sentences. Direct. No hedging.]
DYOR. not financial advice.`;

export function buildDevCheckPrompt(data: DevWalletData): string {
  if (data.error) {
    return `${DEV_CHECK_PERSONALITY}

WALLET: ${data.walletAddress}
RESULT: ${data.error}

Respond accordingly. Keep it short.`;
  }

  const projectLines = data.projects.map((p) => {
    const mcap = p.currentMcap > 0 ? `$${(p.currentMcap / 1e6).toFixed(2)}M mcap` : "no mcap data";
    const tax = p.buyTax > 0 || p.sellTax > 0 ? `tax: ${p.buyTax.toFixed(0)}%/${p.sellTax.toFixed(0)}%` : "";
    const holders = p.holderCount > 0 ? `${p.holderCount} holders` : "";
    const honeypot = p.isHoneypot ? "HONEYPOT" : "";
    const details = [mcap, tax, holders, honeypot].filter(Boolean).join(", ");
    return `- ${p.name} (${p.symbol}) [${p.chain}] — ${p.status.toUpperCase()} — ${p.ageInDays}d old — ${details}`;
  }).join("\n");

  const redFlagLines = data.redFlags.length > 0
    ? data.redFlags.map((f) => `- ${f}`).join("\n")
    : "- None detected";

  const greenFlagLines = data.greenFlags.length > 0
    ? data.greenFlags.map((f) => `- ${f}`).join("\n")
    : "- None detected";

  return `${DEV_CHECK_PERSONALITY}

WALLET DATA FOR ANALYSIS:

Wallet: ${data.walletAddress}
Total deployed: ${data.totalDeployed}
Active: ${data.activeProjects} | Dead: ${data.deadProjects} | Rugged: ${data.ruggedProjects} | Unknown: ${data.unknownProjects}
First deploy: ${data.firstDeployDate}
Avg project lifespan: ${data.avgProjectLifespanDays} days

PROJECTS:
${projectLines}

RED FLAGS DETECTED:
${redFlagLines}

GREEN FLAGS DETECTED:
${greenFlagLines}

Now give your full assessment in the exact format specified. Be specific. Reference the data above.`;
}
