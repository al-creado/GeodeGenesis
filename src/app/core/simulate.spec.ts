import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { medianDay, PROFILES, simulatePlayer } from './simulate';
import { ROSTER } from './roster';

describe('simulatePlayer', () => {
  it('is deterministic for a seed', () => {
    expect(simulatePlayer(PROFILES[1], 60, 7)).toEqual(simulatePlayer(PROFILES[1], 60, 7));
  });

  it('keeps results consistent', () => {
    const r = simulatePlayer(PROFILES[1], 90, 3);
    expect(r.ownedAtEnd).toBeLessThanOrEqual(ROSTER.length);
    expect(r.dayOwned[0]).toBe(0);
    // milestones never go backwards
    const days = r.dayOwned.filter((d): d is number => d !== null);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(r.totalCracks).toBeGreaterThan(0);
  });

  it('pays for what it spends: with no income only the free pulls and starting coins are used', () => {
    const none = { reward: {} };
    const poor = {
      ...GAME_CONFIG,
      economy: { ...GAME_CONFIG.economy, postCrackBonus: 0, streakRewards: Array(7).fill(none.reward) },
      goals: { ...GAME_CONFIG.goals, daily: [], weekly: [] },
      progression: { ...GAME_CONFIG.progression, milestones: [] },
      shop: { ...GAME_CONFIG.shop, sparkAt: 1_000_000 },
    };
    const r = simulatePlayer(PROFILES[2], 1, 1, poor);
    // day 1: the free daily pull, then 300 coins = 3 single pulls (the first pull is the free one)
    expect(r.totalCracks).toBe(1 + 3);
  });

  it('a daily player with ads out-collects a casual player', () => {
    const avg = (i: number) => {
      let sum = 0;
      for (let s = 1; s <= 20; s++) sum += simulatePlayer(PROFILES[i], 40, s).ownedAtEnd;
      return sum / 20;
    };
    expect(avg(2)).toBeGreaterThan(avg(1));
    expect(avg(1)).toBeGreaterThan(avg(0));
  });

  it('medianDay ignores never-reached results', () => {
    expect(medianDay([3, 5, 9])).toBe(5);
    expect(medianDay([3, null, null])).toBeNull();
    expect(medianDay([2, 4, null])).toBe(4); // sorted: 2, 4, never
  });
});
