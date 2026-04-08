import { getDB } from "@/lib/marketplace/db";

/**
 * Track user activity for leaderboard scoring.
 * Fire-and-forget — never blocks credit deduction.
 */
export async function trackActivity(
  address: string,
  creditsSpent: number
): Promise<void> {
  try {
    const db = getDB();
    const today = new Date().toISOString().split("T")[0];
    await db.prepare(`
      INSERT INTO user_activity (id, user_address, activity_date, credits_spent, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_address, activity_date)
      DO UPDATE SET credits_spent = credits_spent + excluded.credits_spent
    `).bind(
      crypto.randomUUID(),
      address.toLowerCase(),
      today,
      creditsSpent,
      Date.now()
    ).run();
  } catch {
    // Never block credit deduction — silently fail
  }
}
