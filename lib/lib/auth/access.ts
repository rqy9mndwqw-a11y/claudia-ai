/**
 * Unified Access Control — single source of truth for all access decisions.
 * No route should implement its own ad-hoc gate check.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

const CLAUDIA_TOKEN = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B";
const FREE_CREDIT_AMOUNT = 10;
const TOXICITY_GATE_BALANCE = 25_000;

export type AccessLevel = {
  isPublic: boolean;
  isConnected: boolean;
  isTokenHolder: boolean;
  isNftHolder: boolean;
  isLegendary: boolean;

  canRoastFree: boolean;
  canRoastLevel3: boolean;
  canPredict: boolean;
  canSubmitRotd: boolean;
  canAccessApp: boolean;
  canUseAgents: boolean;
  canEnterArena: boolean;
  canVoteGovernance: boolean;
  canProposeGovernance: boolean;

  hasFreeCredits: boolean;
  freeCreditsRemaining: number;

  rugDetectorLevel: number;
  chartReaderLevel: number;
  macroPulseLevel: number;
  alphaHunterLevel: number;
  ironHandsLevel: number;

  claudiaBalance: number;
  nftTokenIds: number[];
  nftTiers: string[];
};

function buildPublicAccess(): AccessLevel {
  return {
    isPublic: true,
    isConnected: false,
    isTokenHolder: false,
    isNftHolder: false,
    isLegendary: false,
    canRoastFree: true,
    canRoastLevel3: false,
    canPredict: false,
    canSubmitRotd: false,
    canAccessApp: false,
    canUseAgents: false,
    canEnterArena: false,
    canVoteGovernance: false,
    canProposeGovernance: false,
    hasFreeCredits: false,
    freeCreditsRemaining: 0,
    rugDetectorLevel: 0,
    chartReaderLevel: 0,
    macroPulseLevel: 0,
    alphaHunterLevel: 0,
    ironHandsLevel: 0,
    claudiaBalance: 0,
    nftTokenIds: [],
    nftTiers: [],
  };
}

export async function getAccessLevel(
  walletAddress: string | null
): Promise<AccessLevel> {
  if (!walletAddress) return buildPublicAccess();

  const { env } = await getCloudflareContext();
  const db = (env as any).DB;

  // Fetch in parallel
  const [balanceResult, nftResult, freeCredits, skillEffects] = await Promise.all([
    // Token balance from D1 users table or direct RPC
    getClaudiaBalance(walletAddress, env),
    // NFT ownership from D1
    db.prepare(
      `SELECT token_id, tier FROM nft_fighters WHERE owner_address = ? AND is_bot = 0`
    ).bind(walletAddress.toLowerCase()).all().catch(() => ({ results: [] })),
    // Free credits
    db.prepare(
      `SELECT credits_remaining FROM free_credit_grants WHERE wallet_address = ? AND expires_at > ?`
    ).bind(walletAddress.toLowerCase(), Date.now()).first().catch(() => null),
    // Skill effects (graceful — returns zeros if no NFT)
    getSkillEffects(walletAddress, db),
  ]);

  const claudiaBalance = balanceResult;
  const nfts = (nftResult.results || []) as { token_id: number; tier: string }[];
  const nftTokenIds = nfts.map((n) => n.token_id);
  const nftTiers = nfts.map((n) => n.tier);
  const isNftHolder = nfts.length > 0;
  const isLegendary = nftTiers.some((t) => t === "legendary" || t === "oracle");
  const isTokenHolder = claudiaBalance > 0;
  const hasFreeCredits = !isTokenHolder && ((freeCredits as any)?.credits_remaining ?? 0) > 0;
  const freeCreditsRemaining = (freeCredits as any)?.credits_remaining ?? 0;

  // First-time connected user with no $CLAUDIA — grant free credits
  if (!isTokenHolder && !freeCredits) {
    await grantFreeCredits(walletAddress, db).catch(() => {});
  }

  return {
    isPublic: false,
    isConnected: true,
    isTokenHolder,
    isNftHolder,
    isLegendary,

    canRoastFree: true,
    canRoastLevel3: claudiaBalance >= TOXICITY_GATE_BALANCE || isNftHolder,
    canPredict: true,
    canSubmitRotd: true,
    canAccessApp: isTokenHolder || hasFreeCredits,
    canUseAgents: isTokenHolder || hasFreeCredits,
    canEnterArena: isNftHolder,
    canVoteGovernance: isLegendary,
    canProposeGovernance: isLegendary,

    hasFreeCredits,
    freeCreditsRemaining: hasFreeCredits ? freeCreditsRemaining : isTokenHolder ? 0 : FREE_CREDIT_AMOUNT,

    rugDetectorLevel: skillEffects.rugDetectorLevel,
    chartReaderLevel: skillEffects.chartReaderLevel,
    macroPulseLevel: skillEffects.macroPulseLevel,
    alphaHunterLevel: skillEffects.alphaHunterLevel,
    ironHandsLevel: skillEffects.ironHandsLevel,

    claudiaBalance,
    nftTokenIds,
    nftTiers,
  };
}

// ── Helpers ──

async function getClaudiaBalance(address: string, env: any): Promise<number> {
  // Try Zerion if available
  if (env.ZERION_API_KEY) {
    try {
      const { getZerionTokens } = await import("@/lib/data/zerion");
      const tokens = await getZerionTokens(address);
      const claudia = tokens.find(
        (t) => t.contractAddress.toLowerCase() === CLAUDIA_TOKEN.toLowerCase()
      );
      return claudia ? parseFloat(claudia.balance) : 0;
    } catch {}
  }

  // Fallback: direct RPC balanceOf
  try {
    const data = "0x70a08231000000000000000000000000" + address.replace("0x", "").toLowerCase();
    const res = await fetch("https://mainnet.base.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: CLAUDIA_TOKEN, data }, "latest"],
        id: 1,
      }),
    });
    const result = (await res.json()) as any;
    if (!result.result || result.result === "0x") return 0;
    return Number(BigInt(result.result) / BigInt(10 ** 18));
  } catch {
    return 0;
  }
}

async function getSkillEffects(address: string, db: any) {
  const defaults = {
    rugDetectorLevel: 0,
    chartReaderLevel: 0,
    macroPulseLevel: 0,
    alphaHunterLevel: 0,
    ironHandsLevel: 0,
  };

  try {
    const rows = await db.prepare(`
      SELECT ns.skill_id, ns.level
      FROM nft_skills ns
      JOIN nft_fighters nf ON ns.token_id = nf.token_id
      WHERE nf.owner_address = ?
      ORDER BY ns.level DESC
    `).bind(address.toLowerCase()).all();

    const skills: Record<string, number> = {};
    for (const row of (rows.results || []) as any[]) {
      if (!skills[row.skill_id] || row.level > skills[row.skill_id]) {
        skills[row.skill_id] = row.level;
      }
    }

    return {
      rugDetectorLevel: skills["rug_detector"] ?? 0,
      chartReaderLevel: skills["chart_reader"] ?? 0,
      macroPulseLevel: skills["macro_pulse"] ?? 0,
      alphaHunterLevel: skills["alpha_hunter"] ?? 0,
      ironHandsLevel: skills["iron_hands"] ?? 0,
    };
  } catch {
    return defaults;
  }
}

async function grantFreeCredits(walletAddress: string, db: any): Promise<void> {
  const existing = await db.prepare(
    "SELECT id FROM free_credit_grants WHERE wallet_address = ?"
  ).bind(walletAddress.toLowerCase()).first();

  if (existing) return;

  await db.prepare(`
    INSERT INTO free_credit_grants (id, wallet_address, credits_remaining, granted_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    walletAddress.toLowerCase(),
    FREE_CREDIT_AMOUNT,
    Date.now(),
    Date.now() + 24 * 60 * 60 * 1000
  ).run();
}

export async function decrementFreeCredits(
  walletAddress: string,
  amount: number,
  db: any
): Promise<void> {
  await db.prepare(`
    UPDATE free_credit_grants
    SET credits_remaining = MAX(0, credits_remaining - ?)
    WHERE wallet_address = ? AND expires_at > ?
  `).bind(amount, walletAddress.toLowerCase(), Date.now()).run();
}

export async function invalidateAccessCache(walletAddress: string): Promise<void> {
  // For future KV cache — currently no-op since we don't have CLAUDIA_KV bound yet
  // When KV is added: await env.CLAUDIA_KV.delete(`access:${walletAddress}`)
}
