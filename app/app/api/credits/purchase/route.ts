import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog, type Log } from "viem";
import { base } from "viem/chains";
import { requireAuth, rateLimit } from "@/lib/auth";
import { getDB, getOrCreateUser, addCreditsAtomic } from "@/lib/marketplace/db";

/**
 * POST /api/credits/purchase — Verify on-chain CreditPurchase event and issue credits
 *
 * Flow:
 * 1. User calls purchaseWithClaudia() or purchaseWithUsdc() on the ClaudiaCredits contract
 * 2. Contract burns 50%, sends 50% to treasury, emits CreditPurchase event
 * 3. User submits the tx hash here
 * 4. We verify the CreditPurchase event was emitted by OUR contract
 * 5. We verify the wallet in the event matches the authenticated user
 * 6. We atomically issue credits to their D1 balance
 *
 * Security:
 * - Idempotent: same tx hash rejected on second attempt
 * - Fresh viem client per call (no stale state)
 * - Only trusts events from the exact ClaudiaCredits contract address
 * - Wallet in event must match SIWE-authenticated session
 */

// ── ClaudiaCredits contract on Base mainnet ──
const CLAUDIA_CREDITS_CONTRACT = "0x34C2F4c5dcd5D62365673Bc6f44180efb8a81151" as `0x${string}`;

// CreditPurchase event ABI (from ClaudiaCredits.sol)
const CREDIT_PURCHASE_ABI = [
  {
    type: "event",
    name: "CreditPurchase",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "claudiaAmount", type: "uint256", indexed: false },
      { name: "creditsIssued", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: true },
      { name: "paymentAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.meowrpc.com",
  "https://1rpc.io/base",
];

// Minimum confirmations before accepting a purchase tx.
// Base L2 has fast finality but reorgs are theoretically possible in the first few blocks.
// Base L2 produces blocks every ~2s with fast finality. 1 confirmation is sufficient.
const MIN_CONFIRMATIONS = 1;

/**
 * Create a fresh viem client per request with timeout.
 * No singletons — CF Workers best practice.
 */
function getFreshClient() {
  return createPublicClient({
    chain: base,
    transport: http(RPC_URLS[0], {
      timeout: 10_000, // 10 second timeout — don't hang on slow RPC
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    // Auth + rate limit (10 per minute per wallet)
    const rlError = await rateLimit(req, "credits-purchase", 10, 60_000);
    if (rlError) return rlError;

    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const user = await getOrCreateUser(db, session.address);

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const txHash = (body as any).txHash;
    if (!txHash || typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    const normalizedHash = txHash.toLowerCase();

    // ── Idempotency check: has this tx been processed before? ──
    const existingTx = await db.prepare(
      "SELECT id FROM credit_transactions WHERE reference_id = ? AND type = 'purchase'"
    ).bind(normalizedHash).first();

    if (existingTx) {
      return NextResponse.json(
        { error: "This transaction has already been used to purchase credits" },
        { status: 409 }
      );
    }

    // ── Fetch tx receipt from Base (fresh client) ──
    const client = getFreshClient();

    // Fetch receipt with one server-side retry (Base may not have indexed yet)
    let receipt;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        receipt = await client.getTransactionReceipt({
          hash: txHash as `0x${string}`,
        });
        break;
      } catch {
        if (attempt === 0) {
          // Wait 3s and try once more (scheduler.wait is ideal but not available in all runtimes)
          await new Promise((r) => setTimeout(r, 3_000));
          continue;
        }
        return NextResponse.json(
          { error: "Transaction not found on Base. Make sure it's confirmed." },
          { status: 404 }
        );
      }
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction not found on Base after retry." },
        { status: 404 }
      );
    }

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "Transaction failed on-chain" },
        { status: 400 }
      );
    }

    // ── Verify minimum confirmations (prevent reorg attacks) ──
    const currentBlock = await client.getBlockNumber();
    const txBlock = receipt.blockNumber;
    const confirmations = Number(currentBlock - txBlock);

    if (confirmations < MIN_CONFIRMATIONS) {
      return NextResponse.json(
        {
          error: `Transaction needs ${MIN_CONFIRMATIONS} confirmations. Currently ${confirmations}. Try again in a few seconds.`,
          confirmations,
          required: MIN_CONFIRMATIONS,
        },
        { status: 425 } // 425 Too Early
      );
    }

    // ── Find CreditPurchase event from our contract ──
    // Filter logs to only those emitted by the ClaudiaCredits contract
    const contractLogs = receipt.logs.filter(
      (log: Log) => log.address.toLowerCase() === CLAUDIA_CREDITS_CONTRACT.toLowerCase()
    );

    if (contractLogs.length === 0) {
      return NextResponse.json(
        { error: "Transaction did not interact with the ClaudiaCredits contract" },
        { status: 400 }
      );
    }

    // Try to decode each log as CreditPurchase
    let creditEvent: {
      wallet: string;
      claudiaAmount: bigint;
      creditsIssued: bigint;
      paymentToken: string;
      paymentAmount: bigint;
    } | null = null;

    for (const log of contractLogs) {
      try {
        const decoded = decodeEventLog({
          abi: CREDIT_PURCHASE_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "CreditPurchase" && decoded.args) {
          const args = decoded.args as Record<string, unknown>;
          if (!args.wallet || !args.creditsIssued) continue;
          creditEvent = {
            wallet: String(args.wallet),
            claudiaAmount: BigInt(String(args.claudiaAmount ?? 0)),
            creditsIssued: BigInt(String(args.creditsIssued ?? 0)),
            paymentToken: String(args.paymentToken ?? ""),
            paymentAmount: BigInt(String(args.paymentAmount ?? 0)),
          };
          break;
        }
      } catch {
        // Not a CreditPurchase event — skip
        continue;
      }
    }

    if (!creditEvent) {
      return NextResponse.json(
        { error: "No CreditPurchase event found in this transaction" },
        { status: 400 }
      );
    }

    // ── Verify wallet matches authenticated user ──
    if (creditEvent.wallet.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json(
        { error: "CreditPurchase event wallet does not match your authenticated wallet" },
        { status: 403 }
      );
    }

    // ── Extract credit amount from the on-chain event ──
    // The contract already computed creditsIssued = claudiaAmount / 10^18
    // We trust the contract's calculation (it's verified and immutable)
    const credits = Number(creditEvent.creditsIssued);

    if (credits <= 0) {
      return NextResponse.json(
        { error: "Transaction resulted in zero credits" },
        { status: 400 }
      );
    }

    // ── Atomically issue credits in D1 ──
    // The UNIQUE index on (reference_id, type) WHERE type='purchase'
    // catches race conditions where two requests pass the SELECT check simultaneously.
    let newBalance: number;
    try {
      newBalance = await addCreditsAtomic(
        db,
        session.address,
        credits,
        "purchase",
        normalizedHash
      );
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("UNIQUE constraint") || msg.includes("unique")) {
        return NextResponse.json(
          { error: "This transaction has already been used to purchase credits" },
          { status: 409 }
        );
      }
      throw err; // Re-throw unexpected errors
    }

    console.log(JSON.stringify({
      event: "credit_purchase_success",
      wallet: session.address,
      credits,
      txHash: normalizedHash,
      claudiaAmount: Number(creditEvent.claudiaAmount / BigInt(10 ** 18)),
      timestamp: Date.now(),
    }));

    return NextResponse.json({
      credits_added: credits,
      new_balance: newBalance,
      claudia_spent: Number(creditEvent.claudiaAmount / BigInt(10 ** 18)),
      payment_token: creditEvent.paymentToken,
      tx_hash: txHash,
    });
  } catch (err) {
    console.log(JSON.stringify({
      event: "credit_purchase_failed",
      error: (err as Error).message,
      timestamp: Date.now(),
    }));
    return NextResponse.json(
      { error: "Failed to process credit purchase" },
      { status: 500 }
    );
  }
}
