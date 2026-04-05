import type { Env } from "../types.js";

/**
 * Call the main CLAUDIA app with bot-internal auth.
 * Skips credit check on the app side.
 */
async function callApp(env: Env, path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${env.MAIN_APP_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Bot-Internal": env.BOT_INTERNAL_SECRET,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(60000),
  });
}

export async function getLatestScan(env: Env): Promise<any> {
  const res = await callApp(env, "/api/public/scanner");
  if (!res.ok) return null;
  return res.json();
}

export async function chatWithAgent(
  env: Env,
  agentId: string,
  message: string,
  walletAddress: string
): Promise<{ reply: string; credits_used: number } | null> {
  const res = await callApp(env, `/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, walletAddress }),
  });
  if (!res.ok) return null;
  return res.json() as any;
}

export async function getCreditsBalance(env: Env, walletAddress: string): Promise<number> {
  const res = await callApp(env, `/api/credits/balance?wallet=${walletAddress.toLowerCase()}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as any;
  return data.credits || 0;
}

export async function addCredits(env: Env, walletAddress: string, amount: number, reason: string): Promise<boolean> {
  const res = await callApp(env, "/api/credits/add", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: walletAddress.toLowerCase(),
      amount,
      reason,
      idempotencyKey: `tg:${reason}:${Date.now()}`,
    }),
  });
  return res.ok;
}

export async function getClaudiaPrice(): Promise<{ price: string; change24h: string } | null> {
  try {
    const res = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const pair = data.pairs?.[0];
    if (!pair) return null;
    return {
      price: pair.priceUsd || "?",
      change24h: pair.priceChange?.h24 != null ? `${pair.priceChange.h24 >= 0 ? "+" : ""}${pair.priceChange.h24.toFixed(1)}%` : "?",
    };
  } catch {
    return null;
  }
}
