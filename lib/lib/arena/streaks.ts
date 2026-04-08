/**
 * Signal Streaks — heated state with push-your-luck mechanics.
 * 3+ win streak = heated (+10% accuracy, 2x burn cost).
 */

export const HEATED_THRESHOLD = 3;
export const HEATED_ACCURACY_BOOST = 0.10;
export const HEATED_BURN_MULTIPLIER = 2;

export async function checkAndUpdateHeatedState(
  db: any,
  tokenId: number,
  wonLastBattle: boolean
): Promise<{ isHeated: boolean; justBecameHeated: boolean; streak: number }> {
  const fighter = await db.prepare(
    "SELECT current_win_streak, heated_state FROM nft_fighters WHERE token_id = ?"
  ).bind(tokenId).first() as any;

  if (!fighter) return { isHeated: false, justBecameHeated: false, streak: 0 };

  if (!wonLastBattle) {
    const oldStreak = fighter.current_win_streak ?? 0;
    await db.prepare(`
      UPDATE nft_fighters
      SET heated_state = 0, heated_since = NULL, current_win_streak = 0
      WHERE token_id = ?
    `).bind(tokenId).run();
    return { isHeated: false, justBecameHeated: false, streak: oldStreak };
  }

  const newStreak = (fighter.current_win_streak ?? 0) + 1;
  const wasHeated = fighter.heated_state === 1;
  const nowHeated = newStreak >= HEATED_THRESHOLD;

  await db.prepare(`
    UPDATE nft_fighters
    SET current_win_streak = ?,
        heated_state = ?,
        heated_since = CASE WHEN ? = 1 AND heated_state = 0 THEN ? ELSE heated_since END
    WHERE token_id = ?
  `).bind(newStreak, nowHeated ? 1 : 0, nowHeated ? 1 : 0, Date.now(), tokenId).run();

  return {
    isHeated: nowHeated,
    justBecameHeated: nowHeated && !wasHeated,
    streak: newStreak,
  };
}

export function applyHeatedBoost(baseAccuracy: number, isHeated: boolean): number {
  if (!isHeated) return baseAccuracy;
  return Math.min(100, baseAccuracy * (1 + HEATED_ACCURACY_BOOST));
}

export function getHeatedBurnCost(baseBurnCost: number, isHeated: boolean): number {
  return isHeated ? baseBurnCost * HEATED_BURN_MULTIPLIER : baseBurnCost;
}
