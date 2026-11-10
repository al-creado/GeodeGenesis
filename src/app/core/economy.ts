import { GAME_CONFIG, GameConfig, Reward } from './config';

/** Apply a reward multiplier to a coin amount (whole coins). */
export function applyMultiplier(base: number, multiplier: number): number {
  return Math.floor(base * multiplier);
}

/** Only the coins of a reward are multiplied (by an ad). Shards, tickets and luck are never changed. */
export function scaleReward(reward: Reward, multiplier: number): Reward {
  return reward.coins ? { ...reward, coins: applyMultiplier(reward.coins, multiplier) } : reward;
}

export function rewardHasCoins(reward: Reward): boolean {
  return (reward.coins ?? 0) > 0;
}

/** Coin bonus shown after a paid pull of `count` gems. */
export function postCrackBonus(count: number, config: GameConfig = GAME_CONFIG): number {
  return config.economy.postCrackBonus * count;
}

/** Login-calendar progress as stored in the save. */
export interface DailyState {
  /** Calendar day (1..7) claimed last (0 = none yet). */
  readonly claimedDay: number;
  /** Local day number of the last claim, or null. */
  readonly lastClaimDay: number | null;
}

export const INITIAL_DAILY: DailyState = { claimedDay: 0, lastClaimDay: null };

export type DailyCellState = 'claimed' | 'available' | 'upcoming';

export interface DailyCell {
  readonly day: number;
  readonly reward: Reward;
  readonly state: DailyCellState;
}

/** Whole local days since the epoch, so claims reset at local midnight. */
export function localDayNumber(nowMs: number, tzOffsetMinutes: number): number {
  return Math.floor((nowMs - tzOffsetMinutes * 60_000) / 86_400_000);
}

/** Week number (weeks start on Monday) for a local day number. */
export function localWeekNumber(dayNumber: number): number {
  return Math.floor((dayNumber + 3) / 7); // epoch day 0 was a Thursday
}

/**
 * The calendar day (1..7) the next claim would pay, and whether it can be claimed now.
 * The calendar is forgiving: missing a day never resets it, it just waits for you.
 */
export function dailyNext(
  daily: DailyState,
  today: number,
  config: GameConfig = GAME_CONFIG,
): { day: number; canClaim: boolean } {
  const days = config.economy.streakRewards.length;
  const canClaim = daily.lastClaimDay === null || today > daily.lastClaimDay;
  return { day: (daily.claimedDay % days) + 1, canClaim };
}

/** The 7 cells for the login calendar. */
export function dailyCells(daily: DailyState, today: number, config: GameConfig = GAME_CONFIG): DailyCell[] {
  const next = dailyNext(daily, today, config);
  // After day 7 the calendar starts again, so nothing stays lit.
  const lit = daily.claimedDay % config.economy.streakRewards.length === 0 && daily.claimedDay > 0 && next.canClaim ? 0 : daily.claimedDay;
  return config.economy.streakRewards.map((reward, i) => {
    const day = i + 1;
    const state: DailyCellState = day <= lit ? 'claimed' : day === next.day && next.canClaim ? 'available' : 'upcoming';
    return { day, reward, state };
  });
}

/** Claim today's calendar reward. Returns null if already claimed today. */
export function claimDaily(
  daily: DailyState,
  today: number,
  config: GameConfig = GAME_CONFIG,
): { daily: DailyState; day: number; reward: Reward } | null {
  const next = dailyNext(daily, today, config);
  if (!next.canClaim) return null;
  return {
    daily: { claimedDay: next.day, lastClaimDay: today },
    day: next.day,
    reward: config.economy.streakRewards[next.day - 1],
  };
}
