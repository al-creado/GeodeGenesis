import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config';
import { createNewSave, migrateSave } from './save';

const NOW = 1_700_000_000_000;

describe('createNewSave', () => {
  it('uses config defaults and the current version', () => {
    const s = createNewSave(NOW);
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.coins).toBe(GAME_CONFIG.economy.startingCoins);
    expect(s.crewSlots).toBe(GAME_CONFIG.crew.startSlots);
    expect(s.lastIdleCollect).toBe(NOW);
  });
});

describe('migrateSave', () => {
  it('round-trips a valid save', () => {
    const s = { ...createNewSave(NOW), coins: 555, shards: 12, collection: { pebble: { level: 4 } }, crew: ['pebble'] };
    expect(migrateSave(JSON.parse(JSON.stringify(s)), NOW)).toEqual(s);
  });
  it('upgrades a v1 save to v2 with savedAt 0', () => {
    const v1 = { version: 1, coins: 77, collection: { pebble: { level: 2 } } };
    const s = migrateSave(v1, NOW)!;
    expect(s.version).toBe(GAME_CONFIG.saveVersion);
    expect(s.coins).toBe(77);
    expect(s.savedAt).toBe(0);
    expect(s.collection['pebble'].level).toBe(2);
  });
  it('keeps savedAt on a v2 save', () => {
    expect(migrateSave({ ...createNewSave(NOW), savedAt: 12345 }, NOW)!.savedAt).toBe(12345);
  });
  it('rejects junk, missing version and newer versions', () => {
    expect(migrateSave(null, NOW)).toBeNull();
    expect(migrateSave('x', NOW)).toBeNull();
    expect(migrateSave([], NOW)).toBeNull();
    expect(migrateSave({ coins: 5 }, NOW)).toBeNull();
    expect(migrateSave({ version: GAME_CONFIG.saveVersion + 1 }, NOW)).toBeNull();
  });
  it('sanitizes bad values', () => {
    const s = migrateSave(
      {
        version: 1,
        coins: -50,
        shards: 'lots',
        collection: { pebble: { level: 99 }, ghost: { level: 1 }, plum: 'x' },
        crew: ['pebble', 'pebble', 'ghost', 'plum', 7],
        crewSlots: 99,
        pity: { sinceEmerald: 500, sinceRuby: -3 },
        daily: { claimedDay: 40, lastClaimDay: 'yesterday' },
        settings: { adsEnabled: 'no' },
      },
      NOW,
    )!;
    expect(s.coins).toBe(0);
    expect(s.shards).toBe(0);
    expect(s.collection).toEqual({ pebble: { level: GAME_CONFIG.duplicates.maxLevel } });
    expect(s.crew).toEqual(['pebble']);
    expect(s.crewSlots).toBe(GAME_CONFIG.crew.maxSlots);
    expect(s.pity).toEqual({ sinceEmerald: GAME_CONFIG.pity.emeraldOrBetter - 1, sinceRuby: 0 });
    expect(s.daily).toEqual({ claimedDay: 7, lastClaimDay: null });
    expect(s.settings.adsEnabled).toBe(true);
  });
  it('trims the crew to the slot count', () => {
    const s = migrateSave(
      { version: 1, crewSlots: 3, collection: { pebble: { level: 1 }, plum: { level: 1 }, fern: { level: 1 }, ember: { level: 1 } }, crew: ['pebble', 'plum', 'fern', 'ember'] },
      NOW,
    )!;
    expect(s.crew).toHaveLength(3);
  });
});
