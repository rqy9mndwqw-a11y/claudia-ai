export const MIN_CREDITS_SPENT = 500;
export const MIN_ACTIVE_DAYS = 7;

const CREDITS_SPENT_WEIGHT = 10;
const STREAK_WEIGHT = 50;
const CREDITS_PURCHASED_WEIGHT = 5;

export type LeaderboardEntry = {
  rank: number;
  address: string;
  displayAddress: string;
  score: number;
  creditsSpent: number;
  creditsPurchased: number;
  currentStreak: number;
  longestStreak: number;
  analysesRun: number;
  lastActive: string;
  displayName?: string;
  tagline?: string;
  xHandle?: string;
  avatarPreset?: string;
};

export async function calculateLeaderboard(
  db: D1Database,
  month: string // YYYY-MM format
): Promise<LeaderboardEntry[]> {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  // credit_transactions.created_at is TEXT datetime format: "2026-03-28 15:30:00"
  // So we match with the same format for the date range
  const monthStartDt = `${month}-01 00:00:00`;
  const [yr, mo] = month.split("-").map(Number);
  const lastDay = new Date(yr, mo, 0).getDate();
  const monthEndDt = `${month}-${String(lastDay).padStart(2, "0")} 23:59:59`;

  const users = await db.prepare(`
    SELECT
      a.user_address,
      SUM(a.credits_spent) as total_credits_spent,
      SUM(a.analyses_run) as total_analyses,
      COUNT(DISTINCT a.activity_date) as active_days,
      MAX(a.activity_date) as last_active,
      COALESCE(p.total_purchased, 0) as total_credits_purchased
    FROM user_activity a
    LEFT JOIN (
      SELECT address, SUM(amount) as total_purchased
      FROM credit_transactions
      WHERE type = 'purchase'
      AND created_at >= ?
      AND created_at <= ?
      GROUP BY address
    ) p ON LOWER(a.user_address) = LOWER(p.address)
    WHERE a.activity_date >= ? AND a.activity_date <= ?
    GROUP BY a.user_address
    HAVING total_credits_spent >= ? AND active_days >= ?
  `).bind(
    monthStartDt,
    monthEndDt,
    monthStart,
    monthEnd,
    MIN_CREDITS_SPENT,
    MIN_ACTIVE_DAYS
  ).all();

  const entries: LeaderboardEntry[] = [];

  for (const user of users.results as any[]) {
    const streak = await calculateStreak(db, user.user_address);
    const score =
      (user.total_credits_spent * CREDITS_SPENT_WEIGHT) +
      (streak.current * STREAK_WEIGHT) +
      (user.total_credits_purchased * CREDITS_PURCHASED_WEIGHT);

    entries.push({
      rank: 0,
      address: user.user_address,
      displayAddress: `${user.user_address.slice(0, 6)}...${user.user_address.slice(-4)}`,
      score,
      creditsSpent: user.total_credits_spent,
      creditsPurchased: user.total_credits_purchased,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      analysesRun: user.total_analyses || 0,
      lastActive: user.last_active,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => (e.rank = i + 1));

  return entries;
}

async function calculateStreak(
  db: D1Database,
  address: string
): Promise<{ current: number; longest: number }> {
  const days = await db.prepare(`
    SELECT activity_date FROM user_activity
    WHERE user_address = ?
    AND activity_date >= date('now', '-90 days')
    ORDER BY activity_date DESC
  `).bind(address).all();

  if (!days.results.length) return { current: 0, longest: 0 };

  const dates = (days.results as any[]).map((d) => d.activity_date as string);
  const today = new Date().toISOString().split("T")[0];

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  // Check if active today or yesterday to start counting current streak
  if (dates[0] === today) {
    currentStreak = 1;
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dates[0] !== yesterday) {
      // Last active more than 1 day ago — current streak is 0
      // Still calculate longest from history
      let ls = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diff === 1) { ls++; } else { longestStreak = Math.max(longestStreak, ls); ls = 1; }
      }
      longestStreak = Math.max(longestStreak, ls);
      return { current: 0, longest: longestStreak };
    }
    currentStreak = 1;
  }

  // Walk backwards through dates counting consecutive days
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
      currentStreak = tempStreak;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
      // Current streak stops at first gap
      break;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return { current: currentStreak, longest: longestStreak };
}
