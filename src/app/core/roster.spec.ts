import { describe, expect, it } from 'vitest';
import { RARITIES } from './config';
import { gemsOfRarity, ROSTER } from './roster';

describe('ROSTER', () => {
  it('has 24 gems with the v1 rarity split', () => {
    expect(ROSTER).toHaveLength(24);
    const counts = RARITIES.map((r) => gemsOfRarity(ROSTER, r).length);
    expect(counts).toEqual([8, 7, 5, 3, 1]);
  });
  it('has unique ids and names', () => {
    expect(new Set(ROSTER.map((g) => g.id)).size).toBe(24);
    expect(new Set(ROSTER.map((g) => g.name)).size).toBe(24);
  });
  it('includes the named examples', () => {
    const names = ROSTER.map((g) => g.name);
    for (const n of ['Pebble', 'Frost', 'Honey', 'Plum', 'Bluebell', 'Fern', 'Ember', 'Halo']) {
      expect(names).toContain(n);
    }
  });
});
