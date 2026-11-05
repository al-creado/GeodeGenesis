import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, RARITIES, Rarity } from './config';
import { adjustedOdds, computeLuck } from './odds';

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('config', () => {
  it('base odds sum to 100', () => {
    expect(sum(GAME_CONFIG.baseOdds)).toBeCloseTo(100, 10);
  });
  it('has a 7-day streak whose coin rewards never shrink', () => {
    const r = GAME_CONFIG.economy.streakRewards;
    expect(r).toHaveLength(7);
    const coins = r.map((x) => x.coins ?? 0).filter((c) => c > 0);
    expect(coins).toEqual([...coins].sort((a, b) => a - b));
  });
  it('x10 is cheaper than 10 x x1', () => {
    expect(GAME_CONFIG.economy.crackCost1).toBe(100);
    expect(GAME_CONFIG.economy.crackCost10).toBe(900);
  });
});

const lv = (rarity: Rarity, level = 1) => ({ rarity, level });

describe('computeLuck', () => {
  it('is zero for an empty crew', () => {
    expect(computeLuck([])).toBe(0);
  });
  it('sums per-gem luck', () => {
    // 0.5% + 1% + 2% = 3.5%
    expect(computeLuck([lv('amethyst'), lv('emerald'), lv('ruby')])).toBeCloseTo(0.035, 10);
  });
  it('higher levels add luck (10% of base per level above 1)', () => {
    expect(computeLuck([lv('amethyst', 5)])).toBeCloseTo(0.005 * 1.4, 10);
    expect(computeLuck([lv('amethyst', 10)])).toBeCloseTo(0.005 * 1.9, 10);
  });
  it('adds permanent luck from collecting', () => {
    expect(computeLuck([lv('amethyst')], GAME_CONFIG, 0.01)).toBeCloseTo(0.015, 10);
    expect(computeLuck([], GAME_CONFIG, 0.01)).toBeCloseTo(0.01, 10);
  });
  it('caps the total at +15%', () => {
    expect(computeLuck(Array(6).fill(lv('diamond')))).toBe(0.15);
    expect(computeLuck([lv('diamond', 10)], GAME_CONFIG, 0.2)).toBe(0.15);
  });
  it('five max-luck gems exactly reach the cap', () => {
    expect(computeLuck(Array(5).fill(lv('diamond')))).toBe(0.15);
  });
});

describe('adjustedOdds', () => {
  it('returns base odds at zero luck', () => {
    const o = adjustedOdds(0);
    for (const r of RARITIES) expect(o[r]).toBeCloseTo(GAME_CONFIG.baseOdds[r], 10);
  });

  it('matches the spec check at +3.5% luck', () => {
    const o = adjustedOdds(0.035);
    expect(o.quartz).toBeCloseTo(59.17, 2);
    expect(o.amethyst).toBeCloseTo(28.58, 2);
    expect(o.emerald).toBeCloseTo(9.19, 2);
    expect(o.ruby).toBeCloseTo(2.55, 2);
    expect(o.diamond).toBeCloseTo(0.51, 2);
  });

  it.each([0, 0.002, 0.035, 0.1, 0.15])('always renormalizes to 100 (luck %s)', (luck) => {
    expect(sum(adjustedOdds(luck))).toBeCloseTo(100, 10);
  });

  it('luck lowers Quartz and raises every other rarity', () => {
    const base = adjustedOdds(0);
    const lucky = adjustedOdds(0.15);
    expect(lucky.quartz).toBeLessThan(base.quartz);
    for (const r of RARITIES.filter((x) => x !== 'quartz')) expect(lucky[r]).toBeGreaterThan(base[r]);
  });
});
