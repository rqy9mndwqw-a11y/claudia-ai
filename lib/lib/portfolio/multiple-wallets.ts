export type WatchedWallet = {
  address: string;
  label: string | null;
  added_at: number;
};

export async function getWatchedWallets(
  db: D1Database,
  ownerAddress: string
): Promise<WatchedWallet[]> {
  const result = await db
    .prepare("SELECT watch_address as address, label, added_at FROM watched_wallets WHERE owner_address = ? ORDER BY added_at DESC LIMIT 5")
    .bind(ownerAddress.toLowerCase())
    .all();
  return (result.results || []) as unknown as WatchedWallet[];
}

export async function addWatchedWallet(
  db: D1Database,
  ownerAddress: string,
  watchAddress: string,
  label?: string
): Promise<{ success: boolean; error?: string }> {
  const count = (await db
    .prepare("SELECT COUNT(*) as count FROM watched_wallets WHERE owner_address = ?")
    .bind(ownerAddress.toLowerCase())
    .first()) as any;

  if ((count?.count || 0) >= 5) {
    return { success: false, error: "Maximum 5 watched wallets" };
  }

  await db
    .prepare(
      "INSERT OR IGNORE INTO watched_wallets (id, owner_address, watch_address, label, added_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), ownerAddress.toLowerCase(), watchAddress.toLowerCase(), label || null, Date.now())
    .run();

  return { success: true };
}

export async function removeWatchedWallet(
  db: D1Database,
  ownerAddress: string,
  watchAddress: string
): Promise<void> {
  await db
    .prepare("DELETE FROM watched_wallets WHERE owner_address = ? AND watch_address = ?")
    .bind(ownerAddress.toLowerCase(), watchAddress.toLowerCase())
    .run();
}
