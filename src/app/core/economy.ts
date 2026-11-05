import { GAME_CONFIG, GameConfig } from './config';

const HOUR_MS = 3_600_000;

/** Idle coins waiting to be collected, capped at the config's idle cap. */
export function idleAccrued(lastCollectMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): number {
  const hours = Math.min(Math.max(nowMs - lastCollectMs, 0) / HOUR_MS, config.economy.idleCapHours);
  return Math.floor(hours * config.economy.idleCoinsPerHour);
}

/** Fraction (0..1) of the idle storage that is full. */
export function idleFillFraction(lastCollectMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): number {
  return Math.min(Math.max(nowMs - lastCollectMs, 0) / HOUR_MS / config.economy.idleCapHours, 1);
}

/** Milliseconds until the idle storage is full (0 when already full). */
export function idleMsUntilFull(lastCollectMs: number, nowMs: number, config: GameConfig = GAME_CONFIG): number {
  return Math.max(lastCollectMs + config.economy.idleCapHours * HOUR_MS - nowMs, 0);
}

/** Apply a reward multiplier to a coin amount (whole coins). */
export function applyMultiplier(base: number, multiplier: number): number {
  return Math.floor(base * multiplier);
}

/** Coin bonus shown after cracking `count` geodes. */
export function postCrackBonus(count: number, config: GameConfig = GAME_CONFIG): number {
  return config.economy.postCrackBonus * count;
}

/** Daily-bonus progress as stored in the save. */
export interface DailyState {
  /** Day in the current 7-day cycle claimed last (0 = none yet). */
  readonly claimedDay: number;
  /** Local day number of the last claim, or null. */
  readonly lastClaimDay: number | null;
}

export const INITIAL_DAILY: DailyState = { claimedDay: 0, lastClaimDay: null };

export type DailyCellState = 'claimed' | 'available' | 'upcoming';

export interface DailyCell {
  readonly day: number;
  readonly coins: number;
  readonly state: DailyCellState;
}

/** Whole local days since the epoch, so claims reset at local midnight. */
export function localDayNumber(nowMs: number, tzOffsetMinutes: number): number {
  return Math.floor((nowMs - tzOffsetMinutes * 60_000) / 86_400_000);
}

/** The day (1..7) that the next claim would pay out, and whether it can be claimed now. */
export function dailyNext(
  daily: DailyState,
  today: number,
  config: GameConfig = GAME_CONFIG,
): { day: number; canClaim: boolean } {
  const days = config.economy.dailyBonus.length;
  if (daily.lastClaimDay === null) return { day: 1, canClaim: true };
  const gap = today - daily.lastClaimDay;
  if (gap <= 0) {
    return { day: (daily.claimedDay % days) + 1, canClaim: false };
  }
  if (gap === 1) return { day: (daily.claimedDay % days) + 1, canClaim: true };
  return { day: 1, canClaim: true }; // streak broken
}

/** The 7 cells for the daily bonus row. */
export function dailyCells(daily: DailyState, today: number, config: GameConfig = GAME_CONFIG): DailyCell[] {
  const next = dailyNext(daily, today, config);
  const gap = daily.lastClaimDay === null ? Infinity : today - daily.lastClaimDay;
  // Claimed days stay lit today, and tomorrow until a finished cycle wraps; a missed day clears them.
  const lit = gap <= 0 ? daily.claimedDay : gap === 1 && next.day > 1 ? daily.claimedDay : 0;
  return config.economy.dailyBonus.map((coins, i) => {
    const day = i + 1;
    const state: DailyCellState = day <= lit ? 'claimed' : day === next.day && next.canClaim ? 'available' : 'upcoming';
    return { day, coins, state };
  });
}

/** Claim today's bonus. Returns null if already claimed today. */
export function claimDaily(
  daily: DailyState,
  today: number,
  config: GameConfig = GAME_CONFIG,
): { daily: DailyState; day: number; coins: number } | null {
  const next = dailyNext(daily, today, config);
  if (!next.canClaim) return null;
  return {
    daily: { claimedDay: next.day, lastClaimDay: today },
    day: next.day,
    coins: config.economy.dailyBonus[next.day - 1],
  };
}
