import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, RARITIES, Rarity } from './config';
import { adjustedOdds, isAtLeast } from './odds';
import {
  advancePity,
  applyDuplicate,
  Collection,
  crack,
  INITIAL_PITY,
  pendingPity,
  rollRarity,
} from './pull';
import { findGem, ROSTER } from './roster';
import { createSeededRng, createSequenceRng } from './rng';

const gem = (id: string) => findGem(ROSTER, id)!;

describe('rollRarity', () => {
  const odds = adjustedOdds(0);
  it('maps rng values onto cumulative odds', () => {
    expect(rollRarity(odds, createSequenceRng([0]))).toBe('quartz');
    expect(rollRarity(odds, createSequenceRng([0.59]))).toBe('quartz');
    expect(rollRarity(odds, createSequenceRng([0.61]))).toBe('amethyst');
    expect(rollRarity(odds, createSequenceRng([0.89]))).toBe('emerald');
    expect(rollRarity(odds, createSequenceRng([0.98]))).toBe('ruby');
    expect(rollRarity(odds, createSequenceRng([0.999]))).toBe('diamond');
  });
  it('restricts to a minimum tier', () => {
    expect(rollRarity(odds, createSequenceRng([0]), 'emerald')).toBe('emerald');
    expect(rollRarity(odds, createSequenceRng([0.999]), 'ruby')).toBe('diamond');
  });
  it('converges on the odds over many seeded rolls', () => {
    const luck = 0.035;
    const o = adjustedOdds(luck);
    const rng = createSeededRng(12345);
    const n = 200_000;
    const counts: Record<Rarity, number> = { quartz: 0, amethyst: 0, emerald: 0, ruby: 0, diamond: 0 };
    for (let i = 0; i < n; i++) counts[rollRarity(o, rng)]++;
    for (const r of RARITIES) expect((counts[r] / n) * 100).toBeCloseTo(o[r], 0);
  });
});

describe('pity', () => {
  it('counts up on low pulls and resets per tier', () => {
    let p = advancePity(INITIAL_PITY, 'quartz');
    p = advancePity(p, 'amethyst');
    expect(p).toEqual({ sinceEmerald: 2, sinceRuby: 2 });
    p = advancePity(p, 'emerald');
    expect(p).toEqual({ sinceEmerald: 0, sinceRuby: 3 });
    p = advancePity(p, 'diamond');
    expect(p).toEqual({ sinceEmerald: 0, sinceRuby: 0 });
  });

  it('fires emerald pity on the 10th crack', () => {
    expect(pendingPity({ sinceEmerald: 8, sinceRuby: 8 })).toBeNull();
    expect(pendingPity({ sinceEmerald: 9, sinceRuby: 9 })).toBe('emerald');
  });

  it('fires ruby pity on the 50th crack and beats emerald pity', () => {
    expect(pendingPity({ sinceEmerald: 3, sinceRuby: 49 })).toBe('ruby');
    expect(pendingPity({ sinceEmerald: 9, sinceRuby: 49 })).toBe('ruby');
  });

  it('guarantees Emerald+ within 10 cracks even with the worst luck', () => {
    const r = crack(10, { collection: {}, pity: INITIAL_PITY }, 0, createSequenceRng([0]), ROSTER);
    expect(r.results.slice(0, 9).every((x) => x.gem.rarity === 'quartz')).toBe(true);
    expect(r.results[9].gem.rarity).toBe('emerald');
    expect(r.results[9].pityTrigger).toBe('emerald');
    expect(r.pity).toEqual({ sinceEmerald: 0, sinceRuby: 10 });
  });

  it('guarantees Ruby+ at 50 cracks and resets both counters', () => {
    const r = crack(50, { collection: {}, pity: INITIAL_PITY }, 0, createSequenceRng([0]), ROSTER);
    const last = r.results[49];
    expect(last.gem.rarity).toBe('ruby');
    expect(last.pityTrigger).toBe('ruby');
    expect(r.pity).toEqual(INITIAL_PITY);
    // Emerald pity fired at 10, 20, 30, 40 before the ruby guarantee.
    expect(r.results.filter((x) => x.pityTrigger === 'emerald')).toHaveLength(4);
  });

  it('resets counters when the tier drops naturally', () => {
    const rng = createSequenceRng([0.999, 0]); // diamond roll, then gem pick index 0
    const r = crack(1, { collection: {}, pity: { sinceEmerald: 5, sinceRuby: 30 } }, 0, rng, ROSTER);
    expect(r.results[0].gem.id).toBe('halo');
    expect(r.pity).toEqual(INITIAL_PITY);
  });

  it('never exceeds pity limits across a long seeded run', () => {
    let state = { collection: {} as Collection, pity: INITIAL_PITY };
    const rng = createSeededRng(99);
    for (let i = 0; i < 2000; i++) {
      const r = crack(1, state, 0, rng, ROSTER);
      state = { collection: r.collection, pity: r.pity };
      expect(state.pity.sinceEmerald).toBeLessThan(GAME_CONFIG.pity.emeraldOrBetter);
      expect(state.pity.sinceRuby).toBeLessThan(GAME_CONFIG.pity.rubyOrBetter);
    }
  });
});

describe('applyDuplicate', () => {
  it('adds a new gem at level 1', () => {
    const r = applyDuplicate({}, gem('pebble'));
    expect(r.outcome).toBe('new');
    expect(r.collection['pebble']).toEqual({ level: 1 });
  });

  it('levels up a duplicate', () => {
    const r = applyDuplicate({ pebble: { level: 4 } }, gem('pebble'));
    expect(r.outcome).toBe('levelUp');
    expect(r.level).toBe(5);
    expect(r.collection['pebble'].level).toBe(5);
  });

  it('reaches level 10 then converts further duplicates to shards', () => {
    const r9 = applyDuplicate({ pebble: { level: 9 } }, gem('pebble'));
    expect(r9.level).toBe(10);
    expect(r9.shardsGained).toBe(0);
    const r10 = applyDuplicate(r9.collection, gem('pebble'));
    expect(r10.outcome).toBe('shards');
    expect(r10.level).toBe(10);
    expect(r10.shardsGained).toBe(GAME_CONFIG.duplicates.shardsPerDuplicate.quartz);
    expect(r10.collection['pebble'].level).toBe(10);
  });

  it('pays more shards for rarer gems', () => {
    const r = applyDuplicate({ halo: { level: 10 } }, gem('halo'));
    expect(r.shardsGained).toBe(GAME_CONFIG.duplicates.shardsPerDuplicate.diamond);
  });

  it('does not mutate the input collection', () => {
    const c: Collection = { pebble: { level: 2 } };
    applyDuplicate(c, gem('pebble'));
    expect(c['pebble'].level).toBe(2);
  });
});

describe('crack', () => {
  it('is deterministic for a seed', () => {
    const a = crack(10, { collection: {}, pity: INITIAL_PITY }, 0.035, createSeededRng(5), ROSTER);
    const b = crack(10, { collection: {}, pity: INITIAL_PITY }, 0.035, createSeededRng(5), ROSTER);
    expect(a.results.map((x) => x.gem.id)).toEqual(b.results.map((x) => x.gem.id));
  });

  it('marks a repeat inside a single batch as a level-up', () => {
    // Quartz roll then gem index 0 (pebble), twice.
    const rng = createSequenceRng([0, 0, 0, 0]);
    const r = crack(2, { collection: {}, pity: INITIAL_PITY }, 0, rng, ROSTER);
    expect(r.results.map((x) => x.outcome)).toEqual(['new', 'levelUp']);
    expect(r.collection['pebble'].level).toBe(2);
  });

  it('totals shards for a batch at max level', () => {
    const rng = createSequenceRng([0, 0]);
    const r = crack(2, { collection: { pebble: { level: 10 } }, pity: INITIAL_PITY }, 0, rng, ROSTER);
    expect(r.shardsGained).toBe(2 * GAME_CONFIG.duplicates.shardsPerDuplicate.quartz);
  });

  it('always yields gems from the pulled rarity', () => {
    const rng = createSeededRng(2024);
    const r = crack(500, { collection: {}, pity: INITIAL_PITY }, 0.15, rng, ROSTER);
    for (const x of r.results) expect(isAtLeast(x.gem.rarity, 'quartz')).toBe(true);
    expect(r.results).toHaveLength(500);
  });

  it('throws if the roster lacks a rolled rarity', () => {
    const noDiamond = ROSTER.filter((g) => g.rarity !== 'diamond');
    expect(() => crack(1, { collection: {}, pity: INITIAL_PITY }, 0, createSequenceRng([0.9999]), noDiamond)).toThrow();
  });
});
