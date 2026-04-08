import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDB } from "@/lib/marketplace/db";
import { getWatchedWallets, addWatchedWallet, removeWatchedWallet } from "@/lib/portfolio/multiple-wallets";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const db = getDB();
    const wallets = await getWatchedWallets(db, session.address);
    return NextResponse.json({ wallets });
  } catch (err) {
    console.error("Wallets error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to fetch wallets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = (await req.json().catch(() => null)) as any;
    if (!body?.address || !/^0x[a-fA-F0-9]{40}$/.test(body.address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const db = getDB();
    const result = await addWatchedWallet(db, session.address, body.address, body.label);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Add wallet error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to add wallet" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = (await req.json().catch(() => null)) as any;
    if (!body?.address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const db = getDB();
    await removeWatchedWallet(db, session.address, body.address);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove wallet error:", (err as Error).message);
    return NextResponse.json({ error: "Failed to remove wallet" }, { status: 500 });
  }
}
