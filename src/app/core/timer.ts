import { GAME_CONFIG, GameConfig } from './config';

/** The free-pull wait. `lastAt` is when the last free pull was taken (null = ready). */
export interface FreePullState {
  readonly lastAt: number | null;
  /** Time already taken off the wait by ads and shards, since the last free pull. */
  readonly boostMs: number;
}

export const INITIAL_FREE_PULL: FreePullState = { lastAt: null, boostMs: 0 };

/** The wait after the crew's passive cut. */
export function effectiveCooldownMs(reduction: number, config: GameConfig = GAME_CONFIG): number {
  return Math.round(config.freePull.cooldownMs * (1 - Math.min(Math.max(reduction, 0), config.freePull.maxReduction)));
}

/** Milliseconds until the next free pull (0 = ready now). */
export function freePullRemainingMs(state: FreePullState, nowMs: number, cooldownMs: number): number {
  if (state.lastAt === null) return 0;
  const elapsed = Math.max(nowMs - state.lastAt, 0);
  return Math.max(cooldownMs - elapsed - state.boostMs, 0);
}

/** Start the wait after taking a free pull. */
export function startFreePullWait(nowMs: number): FreePullState {
  return { lastAt: nowMs, boostMs: 0 };
}

/**
 * Take `ms` off the wait. Never takes off more than what is left, so a boost is never wasted
 * in the saved state. Returns null if there is nothing to reduce.
 */
export function boostFreePull(
  state: FreePullState,
  nowMs: number,
  cooldownMs: number,
  ms: number,
): { state: FreePullState; reducedMs: number } | null {
  const remaining = freePullRemainingMs(state, nowMs, cooldownMs);
  if (remaining <= 0 || ms <= 0) return null;
  const reducedMs = Math.min(ms, remaining);
  return { state: { ...state, boostMs: state.boostMs + reducedMs }, reducedMs };
}
