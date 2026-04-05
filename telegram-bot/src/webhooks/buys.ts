import type { Env } from "../types.js";
import { sendGroupMessage } from "../lib/telegram.js";

// ── Constants ──

const CLAUDIA_TOKEN = "0x98eBd4Ac5d4f7022140c51e03CAc39d9F94CDE9B".toLowerCase();
const POOL_ADDRESS = "0xE6BE7Cc04136dDADA378175311fbd6424409f997".toLowerCase();
const MIN_USD = 10;
const WHALE_USD = 500;
const RATE_LIMIT_MS = 60_000;

// ── Types ──

interface ParsedBuy {
  walletAddress: string;
  claudiaAmount: string; // wei as string
  wethAmount: string;    // wei as string
  txHash: string;
}

// ── Signature Verification ──

async function verifyAlchemySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// ── Swap Parsing ──

function parseSwapEvents(payload: any): ParsedBuy[] {
  const buys: ParsedBuy[] = [];

  // Alchemy Address Activity webhook: payload.event.activity[]
  const activities: any[] = payload?.event?.activity;
  if (!Array.isArray(activities)) return buys;

  // Group activities by txHash to find paired transfers (WETH in + CLAUDIA out)
  const byTx = new Map<string, any[]>();
  for (const a of activities) {
    const hash = a.hash?.toLowerCase();
    if (!hash) continue;
    if (!byTx.has(hash)) byTx.set(hash, []);
    byTx.get(hash)!.push(a);
  }

  for (const [txHash, transfers] of byTx) {
    // Find CLAUDIA flowing OUT of pool (to buyer)
    // Alchemy uses rawContract.address for token contract, rawContract.rawValue for hex amount
    const claudiaOut = transfers.find(
      (t: any) =>
        t.fromAddress?.toLowerCase() === POOL_ADDRESS &&
        t.rawContract?.address?.toLowerCase() === CLAUDIA_TOKEN
    );
    // Find WETH flowing INTO pool (from buyer or router)
    const wethIn = transfers.find(
      (t: any) =>
        t.toAddress?.toLowerCase() === POOL_ADDRESS &&
        t.rawContract?.address?.toLowerCase() !== CLAUDIA_TOKEN
    );

    if (claudiaOut) {
      // rawContract.rawValue is hex, value is human-readable decimal
      const rawHex = claudiaOut.rawContract?.rawValue;
      let claudiaAmount: string;
      if (typeof rawHex === "string" && rawHex.startsWith("0x")) {
        claudiaAmount = BigInt(rawHex).toString();
      } else if (claudiaOut.rawContract?.decimals != null && claudiaOut.value != null) {
        // Reconstruct from human-readable value + decimals
        const dec = claudiaOut.rawContract.decimals;
        claudiaAmount = BigInt(Math.round(claudiaOut.value * 10 ** dec)).toString();
      } else {
        claudiaAmount = "0";
      }

      let wethAmount = "0";
      if (wethIn) {
        const wethHex = wethIn.rawContract?.rawValue;
        if (typeof wethHex === "string" && wethHex.startsWith("0x")) {
          wethAmount = BigInt(wethHex).toString();
        } else if (wethIn.value != null) {
          const dec = wethIn.rawContract?.decimals ?? 18;
          wethAmount = BigInt(Math.round(wethIn.value * 10 ** dec)).toString();
        }
      }

      buys.push({
        walletAddress: claudiaOut.toAddress,
        claudiaAmount,
        wethAmount,
        txHash,
      });
    }
  }

  return buys;
}

// ── Price Fetch ──

async function getClaudiaUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.dexscreener.com/latest/dex/pairs/base/0xE6BE7Cc04136dDADA378175311fbd6424409f997",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const price = parseFloat(data.pair?.priceUsd);
    return isNaN(price) ? null : price;
  } catch {
    return null;
  }
}

// ── Formatting ──

function truncateWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsd(value: number): string {
  if (value >= 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${Math.round(value)}`;
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

function buildStandardMessage(usdValue: number, wallet: string, price: string | null, txHash: string): string {
  const lines = [
    `\u{1F7E2} $CLAUDIA buy \u2014 ${formatUsd(usdValue)}`,
    `\u{1F45B} ${truncateWallet(wallet)}`,
  ];
  const priceStr = price ? `\u{1F4C8} ${price} | ` : `\u{1F4C8} `;
  lines.push(`${priceStr}basescan.org/tx/${txHash}`);
  return lines.join("\n");
}

function buildWhaleMessage(usdValue: number, txHash: string): string {
  return [
    `\u{1F40B} ${formatUsd(usdValue)} just hit $CLAUDIA`,
    `somebody knows something \u{1F440}`,
    `basescan.org/tx/${txHash}`,
  ].join("\n");
}

function buildBatchMessage(count: number, total: number, largest: number, price: string | null): string {
  const lines = [
    `\u{1F7E2} ${count} buys in the last minute \u2014 $CLAUDIA`,
    `Total: ${formatUsd(total)}`,
    `Largest: ${formatUsd(largest)}`,
  ];
  if (price) lines.push(`Price: ${price}`);
  return lines.join("\n");
}

// ── Main Handler ──

export async function handleBuyWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-alchemy-signature") ?? "";

  if (!(await verifyAlchemySignature(body, signature, env.ALCHEMY_WEBHOOK_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("Invalid JSON body");
    return new Response("Bad request", { status: 400 });
  }

  console.log("Alchemy webhook payload keys:", JSON.stringify(Object.keys(payload)));
  console.log("Alchemy webhook event keys:", JSON.stringify(payload.event ? Object.keys(payload.event) : "no event"));
  console.log("Alchemy webhook sample:", JSON.stringify(payload).slice(0, 2000));

  const buys = parseSwapEvents(payload);
  console.log(`Parsed ${buys.length} buys`);

  if (buys.length === 0) {
    return new Response(JSON.stringify({ status: "ok", buys: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const price = await getClaudiaUsdPrice();
  const priceStr = price ? formatPrice(price) : null;

  for (const buy of buys) {
    const claudiaFloat = Number(BigInt(buy.claudiaAmount)) / 1e18;
    const usdValue = price ? claudiaFloat * price : 0;

    // Log to D1 — skip if tx already processed
    try {
      await env.DB.prepare(
        `INSERT INTO buy_alerts (id, wallet_address, usd_value, claudia_amount, weth_amount, tx_hash, posted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      )
        .bind(
          crypto.randomUUID(),
          buy.walletAddress,
          usdValue,
          buy.claudiaAmount,
          buy.wethAmount,
          buy.txHash,
          Date.now()
        )
        .run();
    } catch (err) {
      // UNIQUE constraint = already processed
      if ((err as Error).message?.includes("UNIQUE")) {
        continue;
      }
      console.error("D1 insert error:", (err as Error).message);
      continue;
    }

    // Skip if below threshold
    if (price && usdValue < MIN_USD) continue;
    // If no price data, still post (we don't want to silently drop)
    if (!price && claudiaFloat < 1_000_000) continue;

    // Rate limiting: check last posted alert
    const lastPost = await env.DB.prepare(
      "SELECT MAX(created_at) as last_at FROM buy_alerts WHERE posted = 1"
    ).first<{ last_at: number | null }>();

    const now = Date.now();
    const timeSinceLast = lastPost?.last_at ? now - lastPost.last_at : RATE_LIMIT_MS + 1;

    if (timeSinceLast < RATE_LIMIT_MS) {
      // Within rate limit window — will be batched on next qualifying alert
      continue;
    }

    // Check for unposted alerts to batch
    const unposted = await env.DB.prepare(
      "SELECT * FROM buy_alerts WHERE posted = 0 AND usd_value >= ? ORDER BY created_at ASC"
    )
      .bind(MIN_USD)
      .all<{
        id: string;
        wallet_address: string;
        usd_value: number;
        tx_hash: string;
      }>();

    const pendingAlerts = unposted.results || [];

    let message: string;

    if (pendingAlerts.length > 1) {
      // Batch message
      const totalUsd = pendingAlerts.reduce((s, a) => s + a.usd_value, 0);
      const largestUsd = Math.max(...pendingAlerts.map((a) => a.usd_value));
      message = buildBatchMessage(pendingAlerts.length, totalUsd, largestUsd, priceStr);
    } else if (usdValue >= WHALE_USD) {
      message = buildWhaleMessage(usdValue, buy.txHash);
    } else {
      message = buildStandardMessage(usdValue, buy.walletAddress, priceStr, buy.txHash);
    }

    const sent = await sendGroupMessage(env, message);

    // Mark all pending as posted
    if (sent) {
      const ids = pendingAlerts.map((a) => a.id);
      for (const id of ids) {
        await env.DB.prepare("UPDATE buy_alerts SET posted = 1 WHERE id = ?").bind(id).run();
      }
    }
  }

  return new Response(JSON.stringify({ status: "ok", buys: buys.length }), {
    headers: { "Content-Type": "application/json" },
  });
}
