import { describe, expect, it } from 'vitest';
import { bestRarity, computeUnlocks } from './unlocks';
import { ROSTER } from './roster';

describe('bestRarity', () => {
  it('is null for an empty collection', () => {
    expect(bestRarity({}, ROSTER)).toBeNull();
  });
  it('finds the rarest owned gem', () => {
    expect(bestRarity({ pebble: { level: 1 }, fern: { level: 1 }, plum: { level: 1 } }, ROSTER)).toBe('emerald');
    expect(bestRarity({ halo: { level: 1 }, pebble: { level: 1 } }, ROSTER)).toBe('diamond');
  });
});

describe('computeUnlocks', () => {
  it('starts with everything locked', () => {
    expect(computeUnlocks(0, null)).toEqual({ vault: false, daily: false, crew: false, shop: false, pity: false });
  });
  it('opens Vault and Daily after the first pull', () => {
    expect(computeUnlocks(1, 'quartz')).toEqual({ vault: true, daily: true, crew: false, shop: false, pity: false });
  });
  it('opens Crew only with an Emerald or better', () => {
    expect(computeUnlocks(5, 'amethyst').crew).toBe(false);
    expect(computeUnlocks(5, 'emerald').crew).toBe(true);
    expect(computeUnlocks(5, 'diamond').crew).toBe(true);
  });
  it('opens the shop and pity bars after enough pulls', () => {
    const u = computeUnlocks(10, 'quartz');
    expect(u.shop).toBe(true);
    expect(u.pity).toBe(true);
    expect(computeUnlocks(9, 'quartz').shop).toBe(false);
  });
  it('pity guarantees Crew unlocks within the pity window', () => {
    // An Emerald or better is guaranteed by pull 10, so Crew is always reachable.
    expect(computeUnlocks(10, 'emerald').crew).toBe(true);
  });
});
