import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { adjustedOdds } from './odds';
import { applyRemoteOverrides, parseRemoteConfigJson } from './remote-config';

describe('applyRemoteOverrides', () => {
  it('returns the base config for empty or junk input', () => {
    expect(applyRemoteOverrides(GAME_CONFIG, null).config).toBe(GAME_CONFIG);
    expect(applyRemoteOverrides(GAME_CONFIG, 'x').config).toBe(GAME_CONFIG);
    expect(parseRemoteConfigJson('').config).toBe(GAME_CONFIG);
    expect(parseRemoteConfigJson('{nope').rejected).toEqual(['json']);
  });

  it('applies valid economy changes and leaves the rest alone', () => {
    const r = applyRemoteOverrides(GAME_CONFIG, { economy: { crackCost1: 80, crackCost10: 700, idleCoinsPerHour: 55 } });
    expect(r.applied).toEqual(['economy']);
    expect(r.config.economy.crackCost1).toBe(80);
    expect(r.config.economy.crackCost10).toBe(700);
    expect(r.config.economy.idleCoinsPerHour).toBe(55);
    expect(r.config.economy.idleCapHours).toBe(GAME_CONFIG.economy.idleCapHours);
    expect(r.config.baseOdds).toBe(GAME_CONFIG.baseOdds);
  });

  it('rejects an invalid group without blocking others', () => {
    const r = applyRemoteOverrides(GAME_CONFIG, {
      economy: { crackCost1: -5 },
      pity: { emeraldOrBetter: 8 },
    });
    expect(r.rejected).toEqual(['economy']);
    expect(r.applied).toEqual(['pity']);
    expect(r.config.economy.crackCost1).toBe(GAME_CONFIG.economy.crackCost1);
    expect(r.config.pity.emeraldOrBetter).toBe(8);
    expect(r.config.pity.rubyOrBetter).toBe(GAME_CONFIG.pity.rubyOrBetter);
  });

  it('requires base odds to sum to 100', () => {
    const bad = applyRemoteOverrides(GAME_CONFIG, { baseOdds: { quartz: 50, amethyst: 28, emerald: 9, ruby: 2.5, diamond: 0.5 } });
    expect(bad.rejected).toEqual(['baseOdds']);
    expect(bad.config.baseOdds).toBe(GAME_CONFIG.baseOdds);

    const good = applyRemoteOverrides(GAME_CONFIG, { baseOdds: { quartz: 58, amethyst: 28, emerald: 11, ruby: 2.5, diamond: 0.5 } });
    expect(good.applied).toEqual(['baseOdds']);
    const odds = adjustedOdds(0, good.config);
    expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(odds.emerald).toBeCloseTo(11, 10);
  });

  it('validates the daily bonus length and values', () => {
    expect(applyRemoteOverrides(GAME_CONFIG, { economy: { dailyBonus: [1, 2, 3] } }).rejected).toEqual(['economy']);
    const ok = applyRemoteOverrides(GAME_CONFIG, { economy: { dailyBonus: [10, 20, 30, 40, 50, 60, 70] } });
    expect(ok.config.economy.dailyBonus[3]).toBe(40);
  });

  it('bounds the ad multiplier and luck values', () => {
    expect(applyRemoteOverrides(GAME_CONFIG, { economy: { adMultiplier: 0.5 } }).rejected).toEqual(['economy']);
    expect(applyRemoteOverrides(GAME_CONFIG, { economy: { adMultiplier: 50 } }).rejected).toEqual(['economy']);
    expect(applyRemoteOverrides(GAME_CONFIG, { economy: { adMultiplier: 3 } }).config.economy.adMultiplier).toBe(3);
    expect(applyRemoteOverrides(GAME_CONFIG, { luckPerGem: { diamond: 5 } }).rejected).toEqual(['luckPerGem']);
    expect(applyRemoteOverrides(GAME_CONFIG, { crew: { luckCap: 0.2 } }).config.crew.luckCap).toBe(0.2);
  });

  it('can never change ad unit ids, save version, level cap or slot counts', () => {
    const r = applyRemoteOverrides(GAME_CONFIG, {
      ads: { admob: { rewardedUnitId: 'evil' } },
      saveVersion: 99,
      duplicates: { maxLevel: 99 },
      crew: { maxSlots: 50, startSlots: 1 },
    });
    expect(r.config.ads).toBe(GAME_CONFIG.ads);
    expect(r.config.saveVersion).toBe(GAME_CONFIG.saveVersion);
    expect(r.config.duplicates.maxLevel).toBe(GAME_CONFIG.duplicates.maxLevel);
    expect(r.config.crew.maxSlots).toBe(GAME_CONFIG.crew.maxSlots);
    expect(r.config.crew.startSlots).toBe(GAME_CONFIG.crew.startSlots);
  });

  it('does not mutate the base config', () => {
    const before = JSON.stringify(GAME_CONFIG);
    applyRemoteOverrides(GAME_CONFIG, { economy: { crackCost1: 1 }, pity: { rubyOrBetter: 5 } });
    expect(JSON.stringify(GAME_CONFIG)).toBe(before);
  });

  it('parses JSON text from the Remote Config parameter', () => {
    const r = parseRemoteConfigJson('{"pity":{"emeraldOrBetter":9}}');
    expect(r.config.pity.emeraldOrBetter).toBe(9);
  });
});
