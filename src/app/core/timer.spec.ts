import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { boostFreePull, effectiveCooldownMs, freePullRemainingMs, INITIAL_FREE_PULL, startFreePullWait } from './timer';

const FP = GAME_CONFIG.freePull;
const T = 1_700_000_000_000;

describe('free-pull wait', () => {
  it('is much shorter than the old 8 hours', () => {
    expect(FP.cooldownMs).toBeLessThan(8 * 3_600_000);
  });

  it('is ready when no free pull has been taken', () => {
    expect(freePullRemainingMs(INITIAL_FREE_PULL, T, FP.cooldownMs)).toBe(0);
  });

  it('counts down from the last free pull', () => {
    const s = startFreePullWait(T);
    expect(freePullRemainingMs(s, T, FP.cooldownMs)).toBe(FP.cooldownMs);
    expect(freePullRemainingMs(s, T + 3_600_000, FP.cooldownMs)).toBe(FP.cooldownMs - 3_600_000);
    expect(freePullRemainingMs(s, T + FP.cooldownMs, FP.cooldownMs)).toBe(0);
    expect(freePullRemainingMs(s, T + FP.cooldownMs * 5, FP.cooldownMs)).toBe(0);
  });

  it('does not go backwards if the clock moves back', () => {
    const s = startFreePullWait(T);
    expect(freePullRemainingMs(s, T - 10_000_000, FP.cooldownMs)).toBe(FP.cooldownMs);
  });

  it('applies the crew cut, capped', () => {
    expect(effectiveCooldownMs(0)).toBe(FP.cooldownMs);
    expect(effectiveCooldownMs(0.25)).toBe(Math.round(FP.cooldownMs * 0.75));
    expect(effectiveCooldownMs(0.9)).toBe(Math.round(FP.cooldownMs * (1 - FP.maxReduction)));
    expect(effectiveCooldownMs(-1)).toBe(FP.cooldownMs);
  });
});

describe('boostFreePull', () => {
  it('takes time off the wait', () => {
    const s = startFreePullWait(T);
    const b = boostFreePull(s, T, FP.cooldownMs, FP.adReduceMs)!;
    expect(b.reducedMs).toBe(FP.adReduceMs);
    expect(freePullRemainingMs(b.state, T, FP.cooldownMs)).toBe(FP.cooldownMs - FP.adReduceMs);
  });

  it('stacks', () => {
    let s = startFreePullWait(T);
    s = boostFreePull(s, T, FP.cooldownMs, 1_000_000)!.state;
    s = boostFreePull(s, T, FP.cooldownMs, 1_000_000)!.state;
    expect(freePullRemainingMs(s, T, FP.cooldownMs)).toBe(FP.cooldownMs - 2_000_000);
  });

  it('never takes off more than what is left', () => {
    const s = startFreePullWait(T);
    const b = boostFreePull(s, T + FP.cooldownMs - 500, FP.cooldownMs, FP.adReduceMs)!;
    expect(b.reducedMs).toBe(500);
    expect(freePullRemainingMs(b.state, T + FP.cooldownMs - 500, FP.cooldownMs)).toBe(0);
  });

  it('does nothing when the free pull is already ready', () => {
    expect(boostFreePull(INITIAL_FREE_PULL, T, FP.cooldownMs, FP.adReduceMs)).toBeNull();
    expect(boostFreePull(startFreePullWait(T), T, FP.cooldownMs, 0)).toBeNull();
  });

  it('a new free pull clears earlier boosts', () => {
    let s = startFreePullWait(T);
    s = boostFreePull(s, T, FP.cooldownMs, FP.adReduceMs)!.state;
    expect(startFreePullWait(T + FP.cooldownMs)).toEqual({ lastAt: T + FP.cooldownMs, boostMs: 0 });
  });
});
