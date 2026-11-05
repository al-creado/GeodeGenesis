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

  it('more engaged players progress at least as fast, on average', () => {
    const avg = (p: (typeof PROFILES)[number]) => {
      let sum = 0;
      for (let s = 1; s <= 20; s++) sum += simulatePlayer(p, 60, s).ownedAtEnd;
      return sum / 20;
    };
    expect(avg(PROFILES[0])).toBeLessThan(avg(PROFILES[1]));
    expect(avg(PROFILES[1])).toBeLessThanOrEqual(avg(PROFILES[2]));
  });

  it('pays for what it spends: a poorer config yields fewer cracks', () => {
    const poor = { ...GAME_CONFIG, economy: { ...GAME_CONFIG.economy, idleCoinsPerHour: 0, dailyBonus: [0, 0, 0, 0, 0, 0, 0], postCrackBonus: 0 } };
    expect(simulatePlayer(PROFILES[0], 30, 1, poor).totalCracks).toBe(3); // only the 300 starting coins
  });

  it('medianDay ignores never-reached results', () => {
    expect(medianDay([3, 5, 9])).toBe(5);
    expect(medianDay([3, null, null])).toBeNull();
    expect(medianDay([2, 4, null])).toBe(4); // sorted: 2, 4, never
  });
});
